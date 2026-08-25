import { ApiError } from '../utils/httpError.js';

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    const error = { code: err.code, message: err.message };
    if (err.details) error.details = err.details;
    return res.status(err.status).json({ error });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON in request body' },
    });
  }
  console.error('[error]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
  });
}
