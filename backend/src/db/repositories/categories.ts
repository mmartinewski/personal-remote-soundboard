import type { Database as BetterDatabase } from 'better-sqlite3';

export interface CategoryRow {
  id: number;
  name: string;
  created_at: string;
}

export function listCategories(db: BetterDatabase): CategoryRow[] {
  return db
    .prepare('SELECT id, name, created_at FROM categories ORDER BY name COLLATE NOCASE ASC')
    .all() as CategoryRow[];
}

export function findOrCreateCategory(
  db: BetterDatabase,
  name: string,
): CategoryRow {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Category name cannot be empty.');
  }

  const existing = db
    .prepare('SELECT id, name, created_at FROM categories WHERE name = ?')
    .get(trimmed) as CategoryRow | undefined;

  if (existing) return existing;

  const result = db
    .prepare('INSERT INTO categories(name) VALUES (?)')
    .run(trimmed);

  return {
    id: Number(result.lastInsertRowid),
    name: trimmed,
    created_at: new Date().toISOString(),
  };
}
