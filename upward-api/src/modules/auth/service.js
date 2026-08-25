import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { get, run } from '../../db/database.js';
import { signAccessToken } from '../../middleware/auth.js';
import { ApiError } from '../../utils/httpError.js';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlDays * 86_400_000).toISOString();
  await run(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [crypto.randomUUID(), user.id, sha256(refreshToken), expiresAt],
  );
  return { accessToken, refreshToken, expiresIn: config.accessTokenTtlSeconds };
}

export async function register({ name, email, password }) {
  const existing = await get('SELECT id FROM users WHERE lower(email) = lower(?)', [email]);
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_RESOURCE', 'Email already registered', [
      { field: 'email', issue: 'is already registered' },
    ]);
  }
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  await run('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)', [
    id,
    name,
    email.toLowerCase(),
    passwordHash,
  ]);
  const row = await get('SELECT * FROM users WHERE id = ?', [id]);
  return publicUser(row);
}

export async function login({ email, password }) {
  const user = await get('SELECT * FROM users WHERE lower(email) = lower(?)', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (!user.is_active) {
    throw new ApiError(403, 'FORBIDDEN', 'Account is deactivated');
  }
  const tokens = await issueTokens(user);
  return { ...tokens, user: publicUser(user) };
}

export async function refresh(refreshToken) {
  const row = await get(
    `SELECT rt.id AS rt_id, u.*
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ?
        AND rt.revoked_at IS NULL
        AND rt.expires_at > ?`,
    [sha256(refreshToken), new Date().toISOString()],
  );
  if (!row || !row.is_active) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Refresh token is invalid or expired');
  }
  await run('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [
    new Date().toISOString(),
    row.rt_id,
  ]);
  return issueTokens(row);
}

export async function logout(userId, refreshToken) {
  await run(
    'UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL',
    [new Date().toISOString(), sha256(refreshToken), userId],
  );
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
      { field: 'currentPassword', issue: 'is incorrect' },
    ]);
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    passwordHash,
    new Date().toISOString(),
    userId,
  ]);
  await run(
    'UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
    [new Date().toISOString(), userId],
  );
}
