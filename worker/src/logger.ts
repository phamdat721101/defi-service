import pino from 'pino';

export const log = pino({
  base: { pid: undefined, hostname: undefined },
  errorKey: 'error',
  level: 'info'
});
