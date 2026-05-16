import type { Database as BetterDatabase } from 'better-sqlite3';

const VOLUME_KEY = 'playback_volume';

export function getPlaybackVolume(db: BetterDatabase): number {
  const row = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(VOLUME_KEY) as { value: string } | undefined;

  if (!row) return 75;

  const parsed = Number(row.value);
  if (!Number.isFinite(parsed)) return 75;
  return clampVolume(parsed);
}

export function setPlaybackVolume(db: BetterDatabase, value: number): number {
  const safe = clampVolume(value);
  db.prepare(
    `INSERT INTO app_settings(key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(VOLUME_KEY, String(safe));
  return safe;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 75;
  return Math.max(0, Math.min(100, Math.round(value)));
}
