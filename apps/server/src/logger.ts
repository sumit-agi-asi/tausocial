import pino, { Logger } from 'pino';

export type { Logger };

export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: 'tausocial-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token'
      ],
      censor: '[redacted]'
    }
  });
}
