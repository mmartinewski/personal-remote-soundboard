import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { AppPaths } from '../config/paths.js';
import { getDb } from '../db/connection.js';
import { getClipById } from '../db/repositories/clips.js';
import { assertBinaries } from '../lib/binaries.js';
import { HttpError } from '../middleware/errorHandler.js';
import { playAudio, stopActivePlayback } from '../services/audioPlayer.js';
import { cutToMp3 } from '../services/ffmpeg.js';
import {
  isValidProcessId,
  readStagingMeta,
  stagingMetaExpired,
} from '../services/stagingRegistry.js';
import {
  isValidTimeString,
  timeStringToSeconds,
} from '../services/timeFormat.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLIP_SECONDS = 30;

export function playRouter(paths: AppPaths): Router {
  const router = Router();

  router.post('/stop', (_req, res) => {
    stopActivePlayback();
    res.json({ status: 'stopped' });
  });

  router.post('/test-play', (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
    try {
      assertBinaries(paths);
      const body = (req.body ?? {}) as {
        process_id?: unknown;
        start_time?: unknown;
        end_time?: unknown;
        volume?: unknown;
        audio_normalize?: unknown;
      };
      const processId =
        typeof body.process_id === 'string' ? body.process_id.trim() : '';
      const startStr =
        typeof body.start_time === 'string' ? body.start_time.trim() : '';
      const endStr =
        typeof body.end_time === 'string' ? body.end_time.trim() : '';
      const volume =
        typeof body.volume === 'number' || typeof body.volume === 'string'
          ? clampVolume(Number(body.volume))
          : undefined;
      const normalizeAudio =
        body.audio_normalize === true ||
        body.audio_normalize === 1 ||
        body.audio_normalize === '1' ||
        body.audio_normalize === 'true';
      if (!isValidProcessId(processId)) {
        throw new HttpError(400, 'process_id inválido.', 'invalid_process_id');
      }
      if (!isValidTimeString(startStr) || !isValidTimeString(endStr)) {
        throw new HttpError(
          400,
          'Tempos inválidos (use HH:MM:SS.mmm).',
          'invalid_time',
        );
      }

      const meta = readStagingMeta(paths.mediaTemp, processId);
      if (!meta || stagingMetaExpired(meta, SEVEN_DAYS_MS)) {
        throw new HttpError(404, 'Staging não encontrado.', 'staging_not_found');
      }
      if (!existsSync(meta.audioPath)) {
        throw new HttpError(404, 'Ficheiro de staging em falta.', 'staging_file_missing');
      }

      const startSec = timeStringToSeconds(startStr);
      const endSec = timeStringToSeconds(endStr);
      if (endSec <= startSec) {
        throw new HttpError(400, 'end_time deve ser maior que start_time.', 'invalid_range');
      }
      if (endSec - startSec > MAX_CLIP_SECONDS + 0.001) {
        throw new HttpError(
          400,
          'O trecho não pode exceder 30 segundos.',
          'clip_too_long',
        );
      }
      if (startSec < -0.001 || endSec > meta.durationSeconds + 0.05) {
        throw new HttpError(
          400,
          'Trecho fora da duração do áudio descarregado.',
          'out_of_bounds',
        );
      }

      const previewFile = join(paths.mediaTemp, `${processId}.preview-${Date.now()}.mp3`);
      try {
        await cutToMp3({
          ffmpegExe: paths.ffmpegExe,
          inputFile: meta.audioPath,
          outputFile: previewFile,
          startSeconds: startSec,
          durationSeconds: endSec - startSec,
          sourceDurationSeconds: meta.durationSeconds,
          normalizeAudio,
        });
      } catch {
        try {
          unlinkSync(previewFile);
        } catch {
          /* noop */
        }
        throw new HttpError(502, 'Falha ao gerar pré-escuta do trecho.', 'preview_failed');
      }

      playAudio({
        ffplayExe: paths.ffplayExe,
        audioFile: previewFile,
        volume: volume ?? 75,
        cleanupFileOnExit: previewFile,
      });
      res.json({ status: 'playing' });
    } catch (err) {
      next(err);
    }
    })();
  });

  router.post('/:id/play', (req: Request, res: Response, next: NextFunction) => {
    try {
      assertBinaries(paths);
      const id = parseClipIdParam(req.params.id);
      const db = getDb(paths.databaseFile);
      const row = getClipById(db, id);
      if (!row) {
        throw new HttpError(404, 'Clipe não encontrado.', 'clip_not_found');
      }
      if (!existsSync(row.audio_path)) {
        throw new HttpError(404, 'Ficheiro de áudio não encontrado.', 'audio_missing');
      }
      playAudio({
        ffplayExe: paths.ffplayExe,
        audioFile: row.audio_path,
        volume: row.volume,
      });
      res.json({ status: 'playing' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 75;
  return Math.max(0, Math.min(300, Math.round(value)));
}

function parseClipIdParam(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError(400, 'ID de clipe inválido.', 'invalid_id');
  }
  return id;
}
