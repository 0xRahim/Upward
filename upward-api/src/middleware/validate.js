import { ApiError } from '../utils/httpError.js';

function toApiError(result) {
  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    issue: issue.message,
  }));
  return new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', details);
}

export function validate(schemas = {}) {
  const { body, query } = schemas;
  return (req, _res, next) => {
    try {
      if (body) {
        const result = body.safeParse(req.body ?? {});
        if (!result.success) return next(toApiError(result));
        req.body = result.data;
      }
      if (query) {
        const result = query.safeParse(req.query ?? {});
        if (!result.success) return next(toApiError(result));
        req.validatedQuery = result.data;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
