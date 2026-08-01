function errorHandler(err, req, res, next) {
  console.error('[GLOBAL ERROR]', err.message);
  console.error(err.stack);

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Internal server error';
  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
