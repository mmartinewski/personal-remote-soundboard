import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { clipsRouter } from './routes/clips.js';
import { prefetchRouter } from './routes/prefetch.js';
import { stagingRouter } from './routes/staging.js';
import { playRouter } from './routes/play.js';
import { thumbnailsRouter } from './routes/thumbnails.js';
import { settingsRouter } from './routes/settings.js';
import { logger } from './lib/logger.js';
import type { AppPaths } from './config/paths.js';

export function createApp(paths: AppPaths): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/health', healthRouter(paths));
  app.use('/api/clips/prefetch', prefetchRouter(paths));
  app.use('/api/clips', playRouter(paths));
  app.use('/api/clips', clipsRouter());
  app.use('/api/staging', stagingRouter(paths));
  app.use('/api/thumbnails', thumbnailsRouter(paths));
  app.use('/api/settings', settingsRouter());

  if (existsSync(paths.frontendDist)) {
    app.use(express.static(paths.frontendDist));
    logger.info(`a servir frontend estático de ${paths.frontendDist}`);
  } else {
    logger.info(
      'frontend/dist ausente; em desenvolvimento o Vite serve a UI em http://localhost:5173',
    );
  }

  app.use(errorHandler);

  return app;
}
