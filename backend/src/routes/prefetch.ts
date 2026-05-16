import { Router, type Request, type Response, type NextFunction } from 'express';
import { extname, join } from 'node:path';
import type { AppPaths } from '../config/paths.js';
import { assertBinaries } from '../lib/binaries.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../middleware/errorHandler.js';
import { downloadBestAudio, isValidYoutubeUrl } from '../services/youtube.js';
import { probeDurationSeconds } from '../services/ffprobe.js';
import {
  newStagingProcessId,
  writeStagingMeta,
  type StagingMeta,
} from '../services/stagingRegistry.js';

const MAX_SOURCE_SECONDS = 600;

export function prefetchRouter(paths: AppPaths): Router {
  const router = Router();

  const handler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertBinaries(paths);
      const body = (req.body ?? {}) as { youtube_url?: unknown };
      const url =
        typeof body.youtube_url === 'string' ? body.youtube_url.trim() : '';
      if (!isValidYoutubeUrl(url)) {
        throw new HttpError(400, 'URL do YouTube inválida.', 'invalid_youtube_url');
      }

      const processId = newStagingProcessId();
      const outputBase = join(paths.mediaTemp, processId);

      logger.info('prefetch: a descarregar áudio', { processId, url });
      const audioPath = await downloadBestAudio({
        ytDlpExe: paths.ytDlpExe,
        ffmpegExe: paths.ffmpegExe,
        url,
        outputBase,
      });

      const durationSeconds = await probeDurationSeconds(paths.ffprobeExe, audioPath);
      if (durationSeconds > MAX_SOURCE_SECONDS + 0.01) {
        try {
          const { unlinkSync } = await import('node:fs');
          unlinkSync(audioPath);
        } catch {
          /* noop */
        }
        throw new HttpError(
          400,
          'O vídeo de origem não pode ter mais de 10 minutos.',
          'source_too_long',
        );
      }

      const meta: StagingMeta = {
        processId,
        youtubeUrl: url,
        audioPath,
        durationSeconds,
        createdAt: new Date().toISOString(),
      };
      writeStagingMeta(paths.mediaTemp, meta);

      const ext = extname(audioPath).replace(/^\./, '') || 'unknown';
      res.json({
        process_id: processId,
        duration_seconds: durationSeconds,
        audio_url: `/api/staging/${processId}/audio`,
        thumbnail_url: `/api/staging/${processId}/thumbnail`,
        source_format: ext || 'unknown',
      });
    } catch (err) {
      if (err instanceof HttpError) {
        next(err);
        return;
      }
      logger.error('prefetch falhou', err);
      next(
        new HttpError(
          502,
          'Não foi possível descarregar o áudio (YouTube / yt-dlp).',
          'prefetch_failed',
        ),
      );
    }
  };

  router.post('/', handler);
  router.post('', handler);

  return router;
}
