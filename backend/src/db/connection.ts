import Database, { type Database as BetterDatabase } from 'better-sqlite3';

let dbInstance: BetterDatabase | null = null;

export function getDb(databaseFile: string): BetterDatabase {
  if (dbInstance) return dbInstance;
  const db = new Database(databaseFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  dbInstance = db;
  return db;
}

export function closeDb(): void {
  if (!dbInstance) return;
  try {
    dbInstance.close();
  } catch {
    /* noop */
  }
  dbInstance = null;
}
