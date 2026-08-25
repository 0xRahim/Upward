import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { get } from '../db/database.js';
import { ApiError } from '../utils/httpError.js';

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.accessTokenTtlSeconds,
  });
}

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
    }
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'Access token is invalid or expired');
    }
    const user = await get('SELECT * FROM users WHERE id = ?', [payload.sub]);
    if (!user || !user.is_active) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Account not found or deactivated');
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'FORBIDDEN', 'Admin privileges required'));
  }
  next();
}
