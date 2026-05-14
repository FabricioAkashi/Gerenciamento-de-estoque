export function notFound(req, res, next) {
  const error = new Error(`Rota nao encontrada: ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, req, res, next) {
  const status = error.status || 500;

  res.status(status).json({
    message: error.message || 'Erro interno no servidor',
    details: process.env.NODE_ENV === 'production' ? undefined : error.errors
  });
}
