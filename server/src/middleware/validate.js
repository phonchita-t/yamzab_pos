/**
 * Wraps an async route handler so rejected promises reach the error middleware.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Validates req.body against a Zod schema, replacing it with the parsed value.
 */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: 'Validation failed',
      details: result.error.flatten(),
    });
  }
  req.body = result.data;
  return next();
};

export function errorHandler(err, req, res, _next) {
  // Prisma known request errors
  if (err.code === 'P2002') {
    return res.status(409).json({ error: `Duplicate value for ${err.meta?.target}` });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  console.error(err);
  return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}
