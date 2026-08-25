import crypto from 'node:crypto';
import { all, get, run } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';
import { offset, paginateMeta } from '../../utils/paginate.js';
import { uniqueSlug } from '../../utils/slug.js';

const COURSE_SELECT = `
  SELECT c.*, ca.slug AS category_slug, ca.name AS category_name,
         COALESCE(ag.lesson_count, 0) AS lesson_count,
         COALESCE(ag.total_duration, 0) AS total_duration`;
const COURSE_FROM = `
  FROM courses c
  JOIN categories ca ON ca.id = c.category_id
  LEFT JOIN (
    SELECT m.course_id AS cid,
           COUNT(l.id) AS lesson_count,
           COALESCE(SUM(l.duration_minutes), 0) AS total_duration
      FROM modules m
      LEFT JOIN lessons l ON l.module_id = m.id
     GROUP BY m.course_id
  ) ag ON ag.cid = c.id`;

export function serializeCourse(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url ?? null,
    level: row.level ?? null,
    language: row.language,
    durationMinutes: Number(row.total_duration ?? 0),
    lessonCount: Number(row.lesson_count ?? 0),
    rating: Math.round((row.rating ?? 0) * 10) / 10,
    reviewCount: row.review_count ?? 0,
    studentCount: row.student_count ?? 0,
    isPublished: !!row.is_published,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
    createdAt: row.created_at,
  };
}

export async function getCourseRowByIdOrSlug(idOrSlug, { includeDrafts = false } = {}) {
  const row = await get(
    `${COURSE_SELECT} ${COURSE_FROM}
      WHERE (c.id = ? OR c.slug = ?)${includeDrafts ? '' : ' AND c.is_published = 1'}`,
    [idOrSlug, idOrSlug],
  );
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  return row;
}

export function serializeOutline(courseId) {
  return all(
    `SELECT m.id, m.title, m.position,
            l.id AS lesson_id, l.title AS lesson_title, l.duration_minutes,
            l.is_previewable
       FROM modules m
       LEFT JOIN lessons l ON l.module_id = m.id
      WHERE m.course_id = ?
      ORDER BY m.position ASC, l.position ASC`,
    [courseId],
  ).then((rows) => {
    const modules = [];
    const byId = new Map();
    for (const row of rows) {
      if (!byId.has(row.id)) {
        const mod = { id: row.id, title: row.title, position: row.position, lessons: [] };
        byId.set(row.id, mod);
        modules.push(mod);
      }
      if (row.lesson_id) {
        byId.get(row.id).lessons.push({
          id: row.lesson_id,
          title: row.lesson_title,
          durationMinutes: row.duration_minutes ?? null,
          isPreviewable: !!row.is_previewable,
        });
      }
    }
    return modules;
  });
}

export async function listCourses(query, { publishedOnly = true } = {}) {
  const where = [];
  const params = [];
  if (publishedOnly) where.push('c.is_published = 1');
  if (query.category) {
    where.push('ca.slug = ?');
    params.push(query.category);
  }
  if (query.level) {
    where.push('c.level = ?');
    params.push(query.level);
  }
  if (query.search) {
    where.push('(c.title LIKE ? OR c.description LIKE ?)');
    const like = `%${query.search}%`;
    params.push(like, like);
  }
  const sorts = {
    title: 'c.title COLLATE NOCASE ASC',
    '-title': 'c.title COLLATE NOCASE DESC',
    rating: 'c.rating ASC',
    '-rating': 'c.rating DESC',
    newest: 'c.created_at DESC',
  };
  const orderBy = sorts[query.sort] ?? sorts.newest;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await get(`SELECT COUNT(*) AS n FROM courses c JOIN categories ca ON ca.id = c.category_id ${whereSql}`, params);
  const rows = await all(
    `${COURSE_SELECT} ${COURSE_FROM}
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    [...params, query.perPage, offset(query.page, query.perPage)],
  );
  return {
    data: rows.map(serializeCourse),
    meta: paginateMeta(query.page, query.perPage, total.n),
  };
}

async function assertCategoryExists(categoryId) {
  const cat = await get('SELECT id FROM categories WHERE id = ?', [categoryId]);
  if (!cat) {
    throw new ApiError(422, 'UNPROCESSABLE_ENTITY', 'categoryId does not reference an existing category', [
      { field: 'categoryId', issue: 'unknown category' },
    ]);
  }
}

export async function createCourse(body) {
  await assertCategoryExists(body.categoryId);
  const id = crypto.randomUUID();
  const slug = await uniqueSlug('courses', body.title);
  await run(
    `INSERT INTO courses (id, category_id, title, slug, description, cover_image_url, level, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      body.categoryId,
      body.title,
      slug,
      body.description,
      body.coverImageUrl ?? null,
      body.level ?? null,
      body.isPublished ? 1 : 0,
    ],
  );
  return serializeCourse(await getCourseRowByIdOrSlug(id, { includeDrafts: true }));
}

export async function updateCourse(courseId, patch) {
  const existing = await get('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  const sets = [];
  const params = [];
  if (patch.title !== undefined && patch.title !== existing.title) {
    sets.push('title = ?');
    params.push(patch.title);
    sets.push('slug = ?');
    params.push(await uniqueSlug('courses', patch.title, courseId));
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    params.push(patch.description);
  }
  if (patch.categoryId !== undefined) {
    await assertCategoryExists(patch.categoryId);
    sets.push('category_id = ?');
    params.push(patch.categoryId);
  }
  if (patch.level !== undefined) {
    sets.push('level = ?');
    params.push(patch.level);
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
    await run(`UPDATE courses SET ${sets.join(', ')} WHERE id = ?`, [...params, courseId]);
  }
  return serializeCourse(await getCourseRowByIdOrSlug(courseId, { includeDrafts: true }));
}

export async function deleteCourse(courseId, force) {
  const existing = await get('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  const active = await get(
    `SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ? AND status = 'active'`,
    [courseId],
  );
  if (active.n > 0 && !force) {
    throw new ApiError(
      409,
      'CONFLICT',
      `Course has ${active.n} active enrollment(s); pass ?force=true to delete anyway`,
    );
  }
  await run('DELETE FROM courses WHERE id = ?', [courseId]);
}
