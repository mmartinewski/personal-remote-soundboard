import { Router, type Request, type Response } from 'express';
import type { AppPaths } from '../config/paths.js';

const VERSION = '0.1.0';

export function healthRouter(paths: AppPaths): Router {
  const router = Router();

  // Com `app.use('/api/health', router)`, pedidos sem barra final deixam `req.path`
  // vazio em alguns casos — registar `''` e `'/'` evita 404/500 no dashboard.
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
