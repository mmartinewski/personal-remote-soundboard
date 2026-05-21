import { Router, type Request, type Response, type NextFunction } from 'express';
import { resolvePaths } from '../config/paths.js';
import { getDb } from '../db/connection.js';
import { getCategoryById, renameCategory } from '../db/repositories/categories.js';
import { HttpError } from '../middleware/errorHandler.js';

export function categoriesRouter(): Router {
  const router = Router();
  const paths = resolvePaths();

  router.patch('/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseCategoryId(req.params.id);
      const body = (req.body ?? {}) as { name?: unknown };
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        throw new HttpError(400, 'Category name is required.', 'missing_category_name');
      }

      const db = getDb(paths.databaseFile);
      try {
        const updated = renameCategory(db, id, name);
        res.json({
          id: updated.id,
          name: updated.name,
          message: 'Category renamed.',
        });
      } catch (err) {
        if (err instanceof Error) {
          if (err.message === 'Category not found.') {
            throw new HttpError(404, err.message, 'category_not_found');
          }
          if (err.message === 'Category name already exists.') {
            throw new HttpError(409, err.message, 'category_name_taken');
          }
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseCategoryId(req.params.id);
      const db = getDb(paths.databaseFile);
      const row = getCategoryById(db, id);
      if (!row) {
        throw new HttpError(404, 'Category not found.', 'category_not_found');
      }
      res.json({ id: row.id, name: row.name });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function parseCategoryId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError(400, 'Invalid category ID.', 'invalid_category_id');
  }
  return id;
}
