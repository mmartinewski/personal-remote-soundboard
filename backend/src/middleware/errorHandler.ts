import type { ErrorRequestHandler } from 'express';
import { logger } from '../lib/logger.js';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'HttpError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.code ?? 'http_error',
      message: err.message,
    });
    return;
  }

  logger.error('erro não tratado na rota', err);
  res.status(500).json({
    error: 'internal_error',
    message: 'Erro interno no servidor.',
  });
};
