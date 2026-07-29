function errorHandler(err, req, res, next) {
  console.error('[GLOBAL ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
