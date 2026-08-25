import crypto from 'node:crypto';
import { all, get, run } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';
import { offset, paginateMeta } from '../../utils/paginate.js';
import { uniqueSlug } from '../../utils/slug.js';

export function serializeBundle(row, courses = []) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url ?? null,
    courseCount: courses.length,
    courses,
    isPublished: !!row.is_published,
    createdAt: row.created_at,
  };
}

async function bundleCoursesSummaries(bundleIds) {
  if (!bundleIds.length) return new Map();
  const placeholders = bundleIds.map(() => '?').join(', ');
  const rows = await all(
    `SELECT bc.bundle_id, c.id, c.slug, c.title
       FROM bundle_courses bc
       JOIN courses c ON c.id = bc.course_id
      WHERE bc.bundle_id IN (${placeholders})
      ORDER BY bc.position ASC`,
    bundleIds,
  );
  const map = new Map(bundleIds.map((id) => [id, []]));
  for (const row of rows) map.get(row.bundle_id).push({ id: row.id, slug: row.slug, title: row.title });
  return map;
}

export async function getBundleRowByIdOrSlug(idOrSlug, { includeDrafts = false } = {}) {
  const row = await get(
    `SELECT * FROM bundles WHERE (id = ? OR slug = ?)${includeDrafts ? '' : ' AND is_published = 1'}`,
    [idOrSlug, idOrSlug],
  );
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Bundle not found');
  return row;
}

export async function listBundles(query, { publishedOnly = true } = {}) {
  const where = [];
  const params = [];
  if (publishedOnly) where.push('is_published = 1');
  if (query?.search) {
    where.push('(title LIKE ? OR description LIKE ?)');
    const like = `%${query.search}%`;
    params.push(like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await get(`SELECT COUNT(*) AS n FROM bundles ${whereSql}`, params);
  const rows = await all(
    `SELECT * FROM bundles ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, query.perPage, offset(query.page, query.perPage)],
  );
  const summaries = await bundleCoursesSummaries(rows.map((r) => r.id));
  return {
    data: rows.map((r) => serializeBundle(r, summaries.get(r.id) ?? [])),
    meta: paginateMeta(query.page, query.perPage, total.n),
  };
}

export async function getBundleByIdOrSlug(idOrSlug, { includeDrafts = false } = {}) {
  const row = await getBundleRowByIdOrSlug(idOrSlug, { includeDrafts });
  const summaries = await bundleCoursesSummaries([row.id]);
  return serializeBundle(row, summaries.get(row.id) ?? []);
}

async function validateCourseIds(courseIds) {
  const unique = [...new Set(courseIds)];
  if (unique.length < 2) {
    throw new ApiError(422, 'UNPROCESSABLE_ENTITY', 'A bundle requires at least 2 distinct courses', [
      { field: 'courseIds', issue: 'must contain at least 2 distinct existing course IDs' },
    ]);
  }
  for (const courseId of unique) {
    const exists = await get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!exists) {
      throw new ApiError(422, 'UNPROCESSABLE_ENTITY', `Unknown course ID: ${courseId}`, [
        { field: 'courseIds', issue: `course ${courseId} does not exist` },
      ]);
    }
  }
  return unique;
}

export async function createBundle(body) {
  const courseIds = await validateCourseIds(body.courseIds);
  const id = crypto.randomUUID();
  const slug = await uniqueSlug('bundles', body.title);
  await run(
    `INSERT INTO bundles (id, title, slug, description, cover_image_url, is_published)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, body.title, slug, body.description, body.coverImageUrl ?? null, body.isPublished ? 1 : 0],
  );
  for (let i = 0; i < courseIds.length; i++) {
    await run('INSERT INTO bundle_courses (bundle_id, course_id, position) VALUES (?, ?, ?)', [
      id,
      courseIds[i],
      i + 1,
    ]);
  }
  return getBundleByIdOrSlug(id, { includeDrafts: true });
}

export async function updateBundle(bundleId, patch) {
  const existing = await get('SELECT * FROM bundles WHERE id = ?', [bundleId]);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Bundle not found');
  const sets = [];
  const params = [];
  if (patch.title !== undefined && patch.title !== existing.title) {
    sets.push('title = ?', 'slug = ?');
    params.push(patch.title, await uniqueSlug('bundles', patch.title, bundleId));
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    params.push(patch.description);
  }
  if (patch.coverImageUrl !== undefined) {
    sets.push('cover_image_url = ?');
    params.push(patch.coverImageUrl);
  }
  if (patch.isPublished !== undefined) {
    sets.push('is_published = ?');
    params.push(patch.isPublished ? 1 : 0);
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    await run(`UPDATE bundles SET ${sets.join(', ')} WHERE id = ?`, [...params, bundleId]);
  }
  let courseIds;
  if (patch.courseIds !== undefined) {
    courseIds = await validateCourseIds(patch.courseIds);
    await run('DELETE FROM bundle_courses WHERE bundle_id = ?', [bundleId]);
    for (let i = 0; i < courseIds.length; i++) {
      await run('INSERT INTO bundle_courses (bundle_id, course_id, position) VALUES (?, ?, ?)', [
        bundleId,
        courseIds[i],
        i + 1,
      ]);
    }
  }
  return getBundleByIdOrSlug(bundleId, { includeDrafts: true });
}

export async function deleteBundle(bundleId) {
  const existing = await get('SELECT id FROM bundles WHERE id = ?', [bundleId]);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Bundle not found');
  // Deleting a bundle does not revoke already-granted access:
  // FK uses ON DELETE SET NULL on enrollments.bundle_id.
  await run('DELETE FROM bundles WHERE id = ?', [bundleId]);
}
