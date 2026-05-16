import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { resolvePaths } from '../config/paths.js';
import { getDb } from '../db/connection.js';
import {
  getPlaybackVolume,
  setPlaybackVolume,
} from '../db/repositories/settings.js';
import { HttpError } from '../middleware/errorHandler.js';

export function settingsRouter(): Router {
  const router = Router();
  const paths = resolvePaths();

  const getHandler = (_req: Request, res: Response) => {
    const db = getDb(paths.databaseFile);
    res.json({ playback_volume: getPlaybackVolume(db) });
  };
  router.get('/', getHandler);
  router.get('', getHandler);

  const putHandler = (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = (req.body ?? {}) as { playback_volume?: unknown };
      const value = Number(raw.playback_volume);
      if (!Number.isFinite(value)) {
        throw new HttpError(
          400,
          'playback_volume must be a number from 0 to 100.',
          'invalid_payload',
        );
      }
      const db = getDb(paths.databaseFile);
      const saved = setPlaybackVolume(db, value);
      res.json({ playback_volume: saved });
    } catch (err) {
      next(err);
    }
  };
  router.put('/', putHandler);
  router.put('', putHandler);

  return router;
}
