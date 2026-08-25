import path from 'node:path';

const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  env: env.NODE_ENV || 'development',
  dbPath: env.DB_PATH || path.resolve('data/upward.db'),
  jwtSecret: env.JWT_SECRET || 'dev-secret-change-me-in-production',
  accessTokenTtlSeconds: Number(env.ACCESS_TOKEN_TTL_SECONDS || 900), // 15 minutes
  refreshTokenTtlDays: Number(env.REFRESH_TOKEN_TTL_DAYS || 7),
};
