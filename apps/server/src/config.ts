import { z } from 'zod';

const boolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_SSL: boolean.default('false'),
  PGLITE_DATA_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  JWT_TTL_SECONDS: z.coerce.number().int().min(60).default(43_200),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  CONNECTION_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  MIN_SIGNUP_AGE: z.coerce.number().int().min(0).max(120).default(13),
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional()
});

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  logLevel: string;
  databaseUrl?: string;
  databaseSsl: boolean;
  pgliteDataDir?: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  corsOrigins: string[];
  trustProxy: number;
  rateLimit: { windowMs: number; max: number; authMax: number };
  similarityThreshold: number;
  minSignupAge: number;
  appInsightsConnectionString?: string;
}

const DEV_JWT_SECRET = 'insecure-development-only-secret-change-me-0123456789';

/** Parses and validates environment variables. Throws a readable error on misconfiguration. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const values = parsed.data;
  const production = values.NODE_ENV === 'production';

  if (production && !values.JWT_SECRET) {
    throw new Error('Invalid environment configuration: JWT_SECRET is required in production');
  }
  if (production && !values.DATABASE_URL) {
    throw new Error('Invalid environment configuration: DATABASE_URL is required in production');
  }

  return {
    env: values.NODE_ENV,
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
    databaseUrl: values.DATABASE_URL,
    databaseSsl: values.DATABASE_SSL,
    pgliteDataDir: values.PGLITE_DATA_DIR,
    jwtSecret: values.JWT_SECRET ?? DEV_JWT_SECRET,
    jwtTtlSeconds: values.JWT_TTL_SECONDS,
    corsOrigins: values.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: values.TRUST_PROXY,
    rateLimit: {
      windowMs: values.RATE_LIMIT_WINDOW_MS,
      max: values.RATE_LIMIT_MAX,
      authMax: values.AUTH_RATE_LIMIT_MAX
    },
    similarityThreshold: values.CONNECTION_SIMILARITY_THRESHOLD,
    minSignupAge: values.MIN_SIGNUP_AGE,
    appInsightsConnectionString: values.APPLICATIONINSIGHTS_CONNECTION_STRING
  };
}
