import crypto from 'node:crypto';
import { all, get, run } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';
import { offset, paginateMeta } from '../../utils/paginate.js';
import {
  getCourseRowByIdOrSlug,
  serializeCourse,
} from '../courses/service.js';

export async function getEnrollmentOrNull(userId, courseId) {
  return get(
    `SELECT * FROM enrollments WHERE user_id = ? AND course_id = ? AND status IN ('active', 'completed')`,
    [userId, courseId],
  );
}

export async function progressPercentFor(userId, courseId) {
  const totals = await get(
    `SELECT COUNT(*) AS n FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ?`,
    [courseId],
  );
  if (!totals.n) return 0;
  const done = await get(
    `SELECT COUNT(*) AS n
       FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN modules m ON m.id = l.module_id
      WHERE lp.user_id = ? AND m.course_id = ?`,
    [userId, courseId],
  );
  return Math.round((done.n / totals.n) * 100);
}

function baseSerialize(row, extras = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    bundleId: row.bundle_id ?? null,
    status: row.status,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at ?? null,
    ...extras,
  };
}

export async function serializeEnrollment(row) {
  const courseRow = await getCourseRowByIdOrSlug(row.course_id, { includeDrafts: true });
  const progressPercent = row.status === 'completed' ? 100 : await progressPercentFor(row.user_id, row.course_id);
  return {
    ...baseSerialize(row),
    progressPercent,
    expiresAt: null,
    course: {
      id: courseRow.id,
      slug: courseRow.slug,
      title: courseRow.title,
    },
  };
}

export async function enroll(user, body) {
  if (body.courseId) return enrollInCourse(user.id, body.courseId);
  return enrollInBundle(user.id, body.bundleId);
}

async function assertEnrollableCourse(courseId) {
  let course;
  try {
    course = await getCourseRowByIdOrSlug(courseId);
  } catch (err) {
    throw new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Course does not exist or is not published', [
      { field: 'courseId', issue: 'unknown or unpublished course' },
    ]);
  }
  return course;
}

async function enrollInCourse(userId, courseId) {
  const course = await assertEnrollableCourse(courseId);
  const existing = await get('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?', [
    userId,
    course.id,
  ]);
  if (existing) {
    throw new ApiError(409, 'ALREADY_ENROLLED', 'Already enrolled in this course');
  }
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO enrollments (id, user_id, course_id, bundle_id, status)
     VALUES (?, ?, ?, NULL, 'active')`,
    [id, userId, course.id],
  );
  await run('UPDATE courses SET student_count = student_count + 1 WHERE id = ?', [course.id]);
  const row = await get('SELECT * FROM enrollments WHERE id = ?', [id]);
  const serialized = await serializeEnrollment(row);
  delete serialized.course; // single-object response keeps the flat shape from the docs
  return serialized;
}

async function enrollInBundle(userId, bundleId) {
  const bundle = await get('SELECT * FROM bundles WHERE id = ? AND is_published = 1', [bundleId]);
  if (!bundle) {
    throw new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Bundle does not exist or is not published', [
      { field: 'bundleId', issue: 'unknown or unpublished bundle' },
    ]);
  }
  const courses = await all(
    `SELECT c.id FROM bundle_courses bc JOIN courses c ON c.id = bc.course_id
      WHERE bc.bundle_id = ? AND c.is_published = 1`,
    [bundleId],
  );
  if (!courses.length) {
    throw new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Bundle contains no published courses');
  }
  const created = [];
  for (const course of courses) {
    const existing = await get('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?', [
      userId,
      course.id,
    ]);
    if (existing) continue;
    const id = crypto.randomUUID();
    await run(
      `INSERT INTO enrollments (id, user_id, course_id, bundle_id, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [id, userId, course.id, bundle.id],
    );
    await run('UPDATE courses SET student_count = student_count + 1 WHERE id = ?', [course.id]);
    created.push(await serializeEnrollment(await get('SELECT * FROM enrollments WHERE id = ?', [id])));
  }
  if (!created.length) {
    throw new ApiError(409, 'ALREADY_ENROLLED', 'You are already enrolled in all courses of this bundle');
  }
  return {
    bundleId: bundle.id,
    bundleSlug: bundle.slug,
    status: 'active',
    enrollments: created,
  };
}

export async function listMyEnrollments(userId, { page, perPage, status, type }) {
  const where = ['e.user_id = ?'];
  const params = [userId];
  if (status) {
    where.push('e.status = ?');
    params.push(status);
  }
  if (type === 'course') where.push('e.bundle_id IS NULL');
  if (type === 'bundle') where.push('e.bundle_id IS NOT NULL');
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = await get(`SELECT COUNT(*) AS n FROM enrollments e ${whereSql}`, params);
  const rows = await all(
    `SELECT e.* FROM enrollments e ${whereSql} ORDER BY e.enrolled_at DESC LIMIT ? OFFSET ?`,
    [...params, perPage, offset(page, perPage)],
  );
  const data = [];
  for (const row of rows) data.push(await serializeEnrollment(row));
  return { data, meta: paginateMeta(page, perPage, total.n) };
}

export async function cancelEnrollment(enrollmentId, user) {
  const row = await get('SELECT * FROM enrollments WHERE id = ?', [enrollmentId]);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Enrollment not found');
  if (row.user_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'You can only cancel your own enrollments');
  }
  if (row.status !== 'active' && user.role !== 'admin') {
    throw new ApiError(409, 'CONFLICT', 'Only active enrollments can be cancelled');
  }
  await run('DELETE FROM enrollments WHERE id = ?', [enrollmentId]);
  await run(
    'UPDATE courses SET student_count = MAX(student_count - 1, 0) WHERE id = ?',
    [row.course_id],
  );
}

export async function adminListEnrollments({ page, perPage, userId, courseId, status }) {
  const where = [];
  const params = [];
  if (userId) {
    where.push('e.user_id = ?');
    params.push(userId);
  }
  if (courseId) {
    where.push('e.course_id = ?');
    params.push(courseId);
  }
  if (status) {
    where.push('e.status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await get(`SELECT COUNT(*) AS n FROM enrollments e ${whereSql}`, params);
  const rows = await all(
    `SELECT e.*, u.name AS user_name, u.email AS user_email,
            c.slug AS course_slug, c.title AS course_title
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c ON c.id = e.course_id
       ${whereSql}
      ORDER BY e.enrolled_at DESC
      LIMIT ? OFFSET ?`,
    [...params, perPage, offset(page, perPage)],
  );
  const data = [];
  for (const row of rows) {
    data.push({
      ...baseSerialize(row),
      progressPercent:
        row.status === 'completed'
          ? 100
          : await progressPercentFor(row.user_id, row.course_id),
      expiresAt: null,
      user: { id: row.user_id, name: row.user_name, email: row.user_email },
      course: { id: row.course_id, slug: row.course_slug, title: row.course_title },
    });
  }
  return { data, meta: paginateMeta(page, perPage, total.n) };
}
