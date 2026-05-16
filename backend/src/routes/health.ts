import { Router, type Request, type Response } from 'express';
import type { AppPaths } from '../config/paths.js';

const VERSION = '0.1.0';

export function healthRouter(paths: AppPaths): Router {
  const router = Router();

  // With `app.use('/api/health', router)`, requests without a trailing slash can
  // leave `req.path` empty, so registering both `''` and `'/'` avoids dashboard 404/500s.
  const handler = (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: VERSION,
      appData: paths.appData,
    });
  };
  router.get('/', handler);
  router.get('', handler);

  return router;
}
