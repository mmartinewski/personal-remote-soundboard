import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function cleanupExpiredStaging(mediaTempDir: string, ttlMs = SEVEN_DAYS_MS): number {
  if (!existsSync(mediaTempDir)) return 0;

  let removed = 0;
  const now = Date.now();
  for (const entry of readdirSync(mediaTempDir)) {
    const full = join(mediaTempDir, entry);
    let mtime: number;
    try {
      mtime = statSync(full).mtimeMs;
    } catch {
      continue;
    }
    if (now - mtime > ttlMs) {
      try {
        unlinkSync(full);
        removed += 1;
      } catch (err) {
        logger.warn(`falha a remover staging expirado ${full}`, err);
      }
    }
  }
  return removed;
}

export function newProcessId(): string {
  return randomUUID();
}
