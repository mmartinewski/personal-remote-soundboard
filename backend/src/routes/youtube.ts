import { existsSync, statSync } from 'node:fs';
import { Router, type Request, type Response } from 'express';
import { resolvePaths } from '../config/paths.js';

export function youtubeRouter(): Router {
  const router = Router();
  const paths = resolvePaths();

  const statusHandler = (_req: Request, res: Response) => {
    const cookiesFile = paths.youtubeCookiesFile;
    const connected = existsSync(cookiesFile);
    const updatedAt =
      connected && statSync(cookiesFile).mtime
        ? statSync(cookiesFile).mtime.toISOString()
        : null;

    res.json({
      connected,
      cookies_file: cookiesFile,
      updated_at: updatedAt,
      login_hint:
        'Use the desktop app tray menu "Sign in to YouTube" to sign in with Google and save the session for downloads.',
    });
  };

  router.get('/session', statusHandler);
  router.get('/session/', statusHandler);

  return router;
}
