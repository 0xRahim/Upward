import { all, get, run } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';
import { offset, paginateMeta } from '../../utils/paginate.js';
import { uniqueSlug } from '../../utils/slug.js';

export function serializeUser(row, stats) {
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatarUrl: row.avatar_url ?? null,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  };
  if (stats) user.stats = stats;
  return user;
}

export async function getMe(userId) {
  const row = await get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  const [enrolled, completed, bundles] = await Promise.all([
    get(
      `SELECT COUNT(DISTINCT course_id) AS n FROM enrollments
        WHERE user_id = ? AND status = 'active'`,
      [userId],
    ),
    get(
      `SELECT COUNT(DISTINCT course_id) AS n FROM enrollments
        WHERE user_id = ? AND status = 'completed'`,
      [userId],
    ),
    get(
      `SELECT COUNT(DISTINCT bundle_id) AS n FROM enrollments
        WHERE user_id = ? AND bundle_id IS NOT NULL AND status = 'active'`,
      [userId],
    ),
  ]);
  return serializeUser(row, {
    enrolledCourses: enrolled.n,
    completedCourses: completed.n,
    activeBundles: bundles.n,
  });
}

export async function updateMe(userId, patch) {
  const sets = [];
  const params = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    params.push(patch.name);
  }
  if (patch.avatarUrl !== undefined) {
    sets.push('avatar_url = ?');
    params.push(patch.avatarUrl);
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    params.push(new Date().toISOString(), userId);
    await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getMe(userId);
}

export async function adminListUsers({ page, perPage, role, search }) {
  const where = [];
  const params = [];
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  if (search) {
    where.push('(name LIKE ? OR email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await get(`SELECT COUNT(*) AS n FROM users ${whereSql}`, params);
  const rows = await all(
    `SELECT * FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, perPage, offset(page, perPage)],
  );
  return {
    data: rows.map((r) => serializeUser(r)),
    meta: paginateMeta(page, perPage, total.n),
  };
}

export async function adminUpdateUser(userId, patch, actingUserId) {
  const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  if (patch.isActive === false && userId === actingUserId) {
    throw new ApiError(409, 'CONFLICT', 'You cannot deactivate your own account');
  }
  if (patch.role && patch.role !== user.role && userId === actingUserId) {
    throw new ApiError(409, 'CONFLICT', 'You cannot change your own role');
  }
  const sets = [];
  const params = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    params.push(patch.name);
  }
  if (patch.role !== undefined) {
    sets.push('role = ?');
    params.push(patch.role);
  }
  if (patch.isActive !== undefined) {
    sets.push('is_active = ?');
    params.push(patch.isActive ? 1 : 0);
    if (!patch.isActive) {
      await run(
        'UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
        [new Date().toISOString(), userId],
      );
    }
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [ ...params, userId]);
  }
  const updated = await get('SELECT * FROM users WHERE id = ?', [userId]);
  return serializeUser(updated);
}

export async function adminDeleteUser(userId, actingUserId) {
  if (userId === actingUserId) {
    throw new ApiError(409, 'CONFLICT', 'You cannot delete your own account');
  }
  const user = await get('SELECT id FROM users WHERE id = ?', [userId]);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  await run('DELETE FROM users WHERE id = ?', [userId]);
}
