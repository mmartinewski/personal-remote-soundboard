import { createApp } from './app.js';
import { ensureAppDataDirs, resolvePaths } from './config/paths.js';
import { resolvePort } from './config/port.js';
import { closeLogger, initLogger, logger } from './lib/logger.js';
import { migrate } from './db/migrate.js';
import { getDb } from './db/connection.js';
import { cleanupExpiredStaging } from './services/stagingStore.js';
import { stopActivePlayback } from './services/audioPlayer.js';

async function main(): Promise<void> {
  const paths = resolvePaths();
  ensureAppDataDirs(paths);

  initLogger(paths.logFile);
  logger.info('starting Personal Clip Player', { appData: paths.appData });

  const port = resolvePort(paths.configFile);
  logger.info(`resolved port: ${port}`);

  const db = getDb(paths.databaseFile);
  migrate(db);
  logger.info('SQLite migrations applied');

  const removed = cleanupExpiredStaging(paths.mediaTemp);
  if (removed > 0) {
    logger.info(`initial cleanup: removed ${removed} staging file(s)`);
  }

  const app = createApp(paths);

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`Express listening at http://0.0.0.0:${port}`);
  });

  const shutdown = (signal: string) => {
    logger.info(`received ${signal}, shutting down...`);
    stopActivePlayback();
    server.close(() => {
      try {
        db.close();
      } catch (err) {
        logger.warn('error closing SQLite', err);
      }
      closeLogger();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('startup failed', err);
  closeLogger();
  process.exit(1);
});
