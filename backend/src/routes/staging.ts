import { createReadStream, existsSync, statSync } from 'node:fs';
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { AppPaths } from '../config/paths.js';
import { HttpError } from '../middleware/errorHandler.js';
import {
  guessMimeFromPath,
  isValidProcessId,
  readStagingMeta,
  stagingMetaExpired,
} from '../services/stagingRegistry.js';
import { getYoutubeThumbnailCandidates } from '../services/youtube.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function stagingRouter(paths: AppPaths): Router {
  const router = Router();

  router.get('/:processId/thumbnail', (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const processId = String(req.params.processId ?? '');
        if (!isValidProcessId(processId)) {
          throw new HttpError(400, 'process_id inválido.', 'invalid_process_id');
        }
        const meta = readStagingMeta(paths.mediaTemp, processId);
        if (!meta) {
          throw new HttpError(404, 'Staging não encontrado ou expirado.', 'staging_not_found');
        }
        if (stagingMetaExpired(meta, SEVEN_DAYS_MS)) {
          throw new HttpError(410, 'Staging expirado.', 'staging_expired');
        }

        const image = await fetchYoutubeThumbnail(meta.youtubeUrl);
        res.setHeader('Content-Type', image.contentType);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(image.buffer);
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/:processId/audio', (req: Request, res: Response, next: NextFunction) => {
    try {
      const processId = String(req.params.processId ?? '');
      if (!isValidProcessId(processId)) {
        throw new HttpError(400, 'process_id inválido.', 'invalid_process_id');
      }
      const meta = readStagingMeta(paths.mediaTemp, processId);
      if (!meta) {
        throw new HttpError(404, 'Staging não encontrado ou expirado.', 'staging_not_found');
      }
      if (stagingMetaExpired(meta, SEVEN_DAYS_MS)) {
        throw new HttpError(410, 'Staging expirado.', 'staging_expired');
      }
      const filePath = meta.audioPath;
      if (!existsSync(filePath)) {
        throw new HttpError(404, 'Ficheiro de áudio em staging não encontrado.', 'staging_file_missing');
      }

      const stat = statSync(filePath);
      const size = stat.size;
      const mime = guessMimeFromPath(filePath);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', mime);

      const range = req.headers.range;
      if (range && /^bytes=\d*-\d*$/.test(range)) {
        const parts = range.replace(/bytes=/, '').split('-');
        let start = parseInt(parts[0] ?? '0', 10);
        let end = parts[1] ? parseInt(parts[1], 10) : size - 1;
        if (Number.isNaN(start) || start < 0) start = 0;
        if (Number.isNaN(end) || end >= size) end = size - 1;
        if (start > end) {
          throw new HttpError(416, 'Range inválido.', 'invalid_range');
        }
        const chunkSize = end - start + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        res.setHeader('Content-Length', String(chunkSize));
        createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.setHeader('Content-Length', String(size));
        createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function fetchYoutubeThumbnail(youtubeUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const candidates = getYoutubeThumbnailCandidates(youtubeUrl);
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.startsWith('image/')) continue;
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType,
      };
    } catch {
      /* tenta o próximo candidato */
    }
  }
  throw new HttpError(404, 'Thumbnail do YouTube não encontrada.', 'thumbnail_not_found');
}
