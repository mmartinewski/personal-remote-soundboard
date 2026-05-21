import { renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import type { Database as BetterDatabase } from 'better-sqlite3';
import type { AppPaths } from '../config/paths.js';
import { findOrCreateCategory } from '../db/repositories/categories.js';
import { HttpError } from '../middleware/errorHandler.js';
import { cutToMp3 } from './ffmpeg.js';
import {
  deleteStagingBundle,
  readStagingMeta,
  stagingMetaExpired,
} from './stagingRegistry.js';
import { generateSquareThumbnail, parseCropMeta } from './thumbnail.js';
import { isValidTimeString, timeStringToSeconds } from './timeFormat.js';

const MAX_CLIP_SECONDS = 30;
const STAGING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface NewClipInput {
  title: string;
  youtubeUrl: string;
  startTime: string;
  endTime: string;
  categoryName: string;
  tags: string;
  processId: string;
  cropJson: string | undefined;
  isFavorite: number;
  volume: number;
  audioNormalize: boolean;
  thumbnailBuffer: Buffer;
  originalFilename: string;
  mimeType: string | undefined;
}

function assertPathUnderDir(dir: string, filePath: string): void {
  const base = resolve(dir) + sep;
  const target = resolve(filePath);
  if (!target.toLowerCase().startsWith(base.toLowerCase())) {
    throw new HttpError(500, 'Path is outside the allowed directory.', 'path_safety');
  }
}

function pickUploadExt(originalFilename: string, mimeType: string | undefined): string {
  const ext = extname(originalFilename || '').toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function validateTimesAgainstStaging(
  meta: NonNullable<ReturnType<typeof readStagingMeta>>,
  startTime: string,
  endTime: string,
): { startSec: number; endSec: number; durationSec: number } {
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
    throw new HttpError(400, 'Invalid times (HH:MM:SS.mmm).', 'invalid_time');
  }
  const startSec = timeStringToSeconds(startTime);
  const endSec = timeStringToSeconds(endTime);
  if (endSec <= startSec) {
    throw new HttpError(400, 'end_time must be greater than start_time.', 'invalid_range');
  }
  const durationSec = endSec - startSec;
  if (durationSec > MAX_CLIP_SECONDS + 0.001) {
    throw new HttpError(400, 'The segment cannot exceed 30 seconds.', 'clip_too_long');
  }
  if (startSec < -0.001 || endSec > meta.durationSeconds + 0.05) {
    throw new HttpError(
      400,
      'Segment is outside the downloaded audio duration.',
      'out_of_bounds',
    );
  }
  return { startSec, endSec, durationSec };
}

export async function createClipFromUpload(
  db: BetterDatabase,
  paths: AppPaths,
  input: NewClipInput,
): Promise<number> {
  const meta = readStagingMeta(paths.mediaTemp, input.processId);
  if (!meta || stagingMetaExpired(meta, STAGING_TTL_MS)) {
    throw new HttpError(400, 'Invalid process_id or expired staging.', 'invalid_process_id');
  }
  const { startSec, endSec, durationSec } = validateTimesAgainstStaging(
    meta,
    input.startTime,
    input.endTime,
  );

  const uploadExt = pickUploadExt(input.originalFilename, input.mimeType);
  const tmpOrig = join(paths.mediaThumbnails, `tmp_${input.processId}_orig${uploadExt}`);
  const tmpCrop = join(paths.mediaThumbnails, `tmp_${input.processId}_1x1.jpg`);
  const tmpMp3 = join(paths.mediaAudio, `tmp_${input.processId}.mp3`);

  writeFileSync(tmpOrig, input.thumbnailBuffer);
  const cropMeta = parseCropMeta(input.cropJson);
  let cropJsonOut: string;
  try {
    const applied = await generateSquareThumbnail(tmpOrig, tmpCrop, cropMeta);
    cropJsonOut = JSON.stringify(applied);
  } catch (err) {
    cleanupQuiet([tmpOrig, tmpCrop, tmpMp3]);
    throw err;
  }

  try {
    await cutToMp3({
      ffmpegExe: paths.ffmpegExe,
      inputFile: meta.audioPath,
      outputFile: tmpMp3,
      startSeconds: startSec,
      durationSeconds: durationSec,
      sourceDurationSeconds: meta.durationSeconds,
      normalizeAudio: input.audioNormalize,
    });
  } catch {
    cleanupQuiet([tmpOrig, tmpCrop, tmpMp3]);
    throw new HttpError(
      502,
      'Failed to trim/encode the audio (FFmpeg).',
      'ffmpeg_failed',
    );
  }

  let clipId = 0;
  try {
    clipId = db.transaction(() => {
      const cat = findOrCreateCategory(db, input.categoryName);
      const tagsNorm = input.tags.trim().length ? input.tags.trim() : null;
      const info = db
        .prepare(
          `INSERT INTO clips (
            title, youtube_url, start_time, end_time, category_id, tags,
            thumbnail_original_path, thumbnail_cropped_path, thumbnail_crop_meta,
            audio_path, volume, audio_normalize, audio_fade, is_favorite
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          input.title.trim(),
          input.youtubeUrl.trim(),
          input.startTime.trim(),
          input.endTime.trim(),
          cat.id,
          tagsNorm,
          tmpOrig,
          tmpCrop,
          cropJsonOut,
          tmpMp3,
          clampVolume(input.volume),
          input.audioNormalize ? 1 : 0,
          0,
          input.isFavorite ? 1 : 0,
        );
      const id = Number(info.lastInsertRowid);
      const finalOrig = join(paths.mediaThumbnails, `${id}_original${uploadExt}`);
      const finalCrop = join(paths.mediaThumbnails, `${id}_1x1.jpg`);
      const finalMp3 = join(paths.mediaAudio, `${id}.mp3`);
      renameSync(tmpOrig, finalOrig);
      renameSync(tmpCrop, finalCrop);
      renameSync(tmpMp3, finalMp3);
      assertPathUnderDir(paths.mediaThumbnails, finalOrig);
      assertPathUnderDir(paths.mediaThumbnails, finalCrop);
      assertPathUnderDir(paths.mediaAudio, finalMp3);
      db.prepare(
        `UPDATE clips SET thumbnail_original_path = ?, thumbnail_cropped_path = ?, audio_path = ? WHERE id = ?`,
      ).run(finalOrig, finalCrop, finalMp3, id);
      return id;
    })();
  } catch (err) {
    cleanupQuiet([tmpOrig, tmpCrop, tmpMp3]);
    throw err;
  }

  deleteStagingBundle(paths.mediaTemp, input.processId);
  return clipId;
}

function cleanupQuiet(pathsList: string[]): void {
  for (const p of pathsList) {
    try {
      unlinkSync(p);
    } catch {
      /* noop */
    }
  }
}

function pathsExceptExistingTargets(pathsList: string[], targets: string[]): string[] {
  const normalizedTargets = new Set(targets.map(normalizePathKey));
  return pathsList.filter((p) => !normalizedTargets.has(normalizePathKey(p)));
}

function normalizePathKey(filePath: string): string {
  return resolve(filePath).toLowerCase();
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 75;
  return Math.max(0, Math.min(300, Math.round(value)));
}

export interface UpdateClipMetadataInput {
  title: string;
  categoryName: string;
  tags: string;
}

export function updateClipMetadata(
  db: BetterDatabase,
  clipId: number,
  input: UpdateClipMetadataInput,
): void {
  const row = db.prepare('SELECT id FROM clips WHERE id = ?').get(clipId) as
    | { id: number }
    | undefined;
  if (!row) {
    throw new HttpError(404, 'Clip not found.', 'clip_not_found');
  }

  const title = input.title.trim();
  if (!title) {
    throw new HttpError(400, 'Title is required.', 'missing_title');
  }

  const categoryName = input.categoryName.trim();
  if (!categoryName) {
    throw new HttpError(400, 'Category is required.', 'missing_category');
  }

  const cat = findOrCreateCategory(db, categoryName);
  const tagsNorm = input.tags.trim().length ? input.tags.trim() : null;
  db.prepare('UPDATE clips SET title = ?, category_id = ?, tags = ? WHERE id = ?').run(
    title,
    cat.id,
    tagsNorm,
    clipId,
  );
}

export interface UpdateClipInput {
  title: string;
  youtubeUrl: string;
  startTime: string;
  endTime: string;
  categoryName: string;
  tags: string;
  processId: string;
  cropJson: string | undefined;
  isFavorite: number;
  volume: number;
  audioNormalize: boolean;
  thumbnailBuffer?: Buffer;
  originalFilename?: string;
  mimeType?: string | undefined;
}

export async function updateClipFromUpload(
  db: BetterDatabase,
  paths: AppPaths,
  clipId: number,
  input: UpdateClipInput,
): Promise<void> {
  const row = db.prepare('SELECT * FROM clips WHERE id = ?').get(clipId) as
    | {
        id: number;
        thumbnail_original_path: string;
        thumbnail_cropped_path: string;
        thumbnail_crop_meta: string | null;
        audio_path: string;
      }
    | undefined;
  if (!row) {
    throw new HttpError(404, 'Clip not found.', 'clip_not_found');
  }

  const meta = readStagingMeta(paths.mediaTemp, input.processId);
  if (!meta || stagingMetaExpired(meta, STAGING_TTL_MS)) {
    throw new HttpError(400, 'Invalid process_id or expired staging.', 'invalid_process_id');
  }
  const { startSec, endSec, durationSec } = validateTimesAgainstStaging(
    meta,
    input.startTime,
    input.endTime,
  );

  const tmpMp3 = join(paths.mediaAudio, `tmp_put_${input.processId}.mp3`);
  try {
    await cutToMp3({
      ffmpegExe: paths.ffmpegExe,
      inputFile: meta.audioPath,
      outputFile: tmpMp3,
      startSeconds: startSec,
      durationSeconds: durationSec,
      sourceDurationSeconds: meta.durationSeconds,
      normalizeAudio: input.audioNormalize,
    });
  } catch {
    cleanupQuiet([tmpMp3]);
    throw new HttpError(502, 'Failed to trim/encode the audio.', 'ffmpeg_failed');
  }

  let newOrig = row.thumbnail_original_path;
  let newCrop = row.thumbnail_cropped_path;
  let cropMetaOut = row.thumbnail_crop_meta ?? '';

  if (input.thumbnailBuffer && input.thumbnailBuffer.length > 0) {
    const uploadExt = pickUploadExt(
      input.originalFilename ?? '',
      input.mimeType,
    );
    const tmpOrig = join(paths.mediaThumbnails, `tmp_put_${input.processId}_orig${uploadExt}`);
    const tmpCrop = join(paths.mediaThumbnails, `tmp_put_${input.processId}_1x1.jpg`);
    writeFileSync(tmpOrig, input.thumbnailBuffer);
    try {
      const applied = await generateSquareThumbnail(
        tmpOrig,
        tmpCrop,
        parseCropMeta(input.cropJson),
      );
      cropMetaOut = JSON.stringify(applied);
    } catch (err) {
      cleanupQuiet([tmpOrig, tmpCrop, tmpMp3]);
      throw err;
    }
    newOrig = join(paths.mediaThumbnails, `${clipId}_original${uploadExt}`);
    newCrop = join(paths.mediaThumbnails, `${clipId}_1x1.jpg`);
    try {
      cleanupQuiet([newOrig, newCrop]);
      renameSync(tmpOrig, newOrig);
      renameSync(tmpCrop, newCrop);
    } catch (err) {
      cleanupQuiet([tmpOrig, tmpCrop, tmpMp3]);
      throw err;
    }
    cleanupQuiet(pathsExceptExistingTargets([
      row.thumbnail_original_path,
      row.thumbnail_cropped_path,
    ], [newOrig, newCrop]));
  } else if (input.cropJson) {
    const parsed = parseCropMeta(input.cropJson);
    if (parsed) {
      const tmpCrop = join(paths.mediaThumbnails, `tmp_put_${input.processId}_re.jpg`);
      try {
        const applied = await generateSquareThumbnail(
          row.thumbnail_original_path,
          tmpCrop,
          parsed,
        );
        cropMetaOut = JSON.stringify(applied);
        try {
          unlinkSync(row.thumbnail_cropped_path);
        } catch {
          /* noop */
        }
        renameSync(tmpCrop, newCrop);
      } catch (err) {
        cleanupQuiet([tmpCrop]);
        throw err;
      }
    }
  }

  const finalMp3 = join(paths.mediaAudio, `${clipId}.mp3`);
  try {
    cleanupQuiet([finalMp3]);
    renameSync(tmpMp3, finalMp3);
  } catch (err) {
    cleanupQuiet([tmpMp3]);
    throw err;
  }
  cleanupQuiet(pathsExceptExistingTargets([row.audio_path], [finalMp3]));

  const cat = findOrCreateCategory(db, input.categoryName);
  const tagsNorm = input.tags.trim().length ? input.tags.trim() : null;
  db.prepare(
    `UPDATE clips SET
      title = ?, youtube_url = ?, start_time = ?, end_time = ?,
      category_id = ?, tags = ?,
      thumbnail_original_path = ?, thumbnail_cropped_path = ?, thumbnail_crop_meta = ?,
      audio_path = ?, volume = ?, audio_normalize = ?, audio_fade = ?, is_favorite = ?
    WHERE id = ?`,
  ).run(
    input.title.trim(),
    input.youtubeUrl.trim(),
    input.startTime.trim(),
    input.endTime.trim(),
    cat.id,
    tagsNorm,
    newOrig,
    newCrop,
    cropMetaOut || null,
    finalMp3,
    clampVolume(input.volume),
    input.audioNormalize ? 1 : 0,
    0,
    input.isFavorite ? 1 : 0,
    clipId,
  );

  deleteStagingBundle(paths.mediaTemp, input.processId);
}

export function deleteClipFiles(row: {
  thumbnail_original_path: string;
  thumbnail_cropped_path: string;
  audio_path: string;
}): void {
  for (const p of [
    row.thumbnail_original_path,
    row.thumbnail_cropped_path,
    row.audio_path,
  ]) {
    try {
      unlinkSync(p);
    } catch {
      /* noop */
    }
  }
}

export function assertClipPathsBelongToApp(
  paths: AppPaths,
  row: {
    thumbnail_original_path: string;
    thumbnail_cropped_path: string;
    audio_path: string;
  },
): void {
  assertPathUnderDir(paths.mediaThumbnails, row.thumbnail_original_path);
  assertPathUnderDir(paths.mediaThumbnails, row.thumbnail_cropped_path);
  assertPathUnderDir(paths.mediaAudio, row.audio_path);
}
