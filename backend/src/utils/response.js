export const success = (ctx, data = null, message = 'success') => {
  ctx.status = 200;
  ctx.body = {
    code: 0,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

export const error = (ctx, message = 'error', code = 500, statusCode = 500) => {
  ctx.status = statusCode;
  ctx.body = {
    code,
    message,
    data: null,
    timestamp: new Date().toISOString(),
  };
};

export const notFound = (ctx, message = 'Resource not found') => {
  error(ctx, message, 404, 404);
};

export const badRequest = (ctx, message = 'Bad request') => {
  error(ctx, message, 400, 400);
};

export const forbidden = (ctx, message = 'Forbidden') => {
  error(ctx, message, 403, 403);
};
