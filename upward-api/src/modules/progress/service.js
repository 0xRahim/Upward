import crypto from 'node:crypto';
import { all, get, run } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';
import { getEnrollmentOrNull, progressPercentFor } from '../enrollments/service.js';

async function getLessonWithCourse(lessonId) {
  return get(
    `SELECT l.id, l.module_id, m.course_id
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
      WHERE l.id = ?`,
    [lessonId],
  );
}

function assertEnrolled(enrollment) {
  if (!enrollment) {
    throw new ApiError(403, 'NOT_ENROLLED', 'You must be enrolled in this course');
  }
  return enrollment;
}

async function maybeCompleteCourse(userId, courseId, enrollmentId) {
  const percent = await progressPercentFor(userId, courseId);
  let completedAt = null;
  if (percent === 100) {
    const now = new Date().toISOString();
    await run(
      `UPDATE enrollments
          SET status = 'completed', completed_at = COALESCE(completed_at, ?)
        WHERE id = ? AND status = 'active'`,
      [now, enrollmentId],
    );
    const updated = await get('SELECT completed_at FROM enrollments WHERE id = ?', [enrollmentId]);
    completedAt = updated.completed_at;
    // Auto-issue certificate
    const existing = await get(
      'SELECT id FROM certificates WHERE user_id = ? AND course_id = ?',
      [userId, courseId],
    );
    if (!existing) {
      await run('INSERT INTO certificates (id, user_id, course_id) VALUES (?, ?, ?)', [
        `cert-${crypto.randomUUID()}`,
        userId,
        courseId,
      ]);
    }
  }
  return { percent, completedAt };
}

export async function markLessonComplete(user, lessonId) {
  const lesson = await getLessonWithCourse(lessonId);
  if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found');
  const enrollment = assertEnrolled(await getEnrollmentOrNull(user.id, lesson.course_id));
  await run(
    'INSERT OR IGNORE INTO lesson_progress (id, user_id, lesson_id) VALUES (?, ?, ?)',
    [crypto.randomUUID(), user.id, lessonId],
  );
  await run('UPDATE enrollments SET last_lesson_id = ? WHERE id = ?', [
    lessonId,
    enrollment.id,
  ]);
  const { percent } = await maybeCompleteCourse(user.id, lesson.course_id, enrollment.id);
  const row = await get(
    'SELECT completed_at FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
    [user.id, lessonId],
  );
  return {
    lessonId,
    completedAt: row.completed_at,
    courseProgressPercent: percent,
  };
}

export async function markLessonIncomplete(user, lessonId) {
  const lesson = await getLessonWithCourse(lessonId);
  if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found');
  const enrollment = assertEnrolled(await getEnrollmentOrNull(user.id, lesson.course_id));
  await run('DELETE FROM lesson_progress WHERE user_id = ? AND lesson_id = ?', [
    user.id,
    lessonId,
  ]);
  const percent = await progressPercentFor(user.id, lesson.course_id);
  if (percent < 100 && enrollment.status === 'completed') {
    await run(
      "UPDATE enrollments SET status = 'active', completed_at = NULL WHERE id = ?",
      [enrollment.id],
    );
  }
  return getCourseProgress(user.id, lesson.course_id);
}

export async function getCourseProgress(userId, courseId) {
  const course = await get('SELECT id FROM courses WHERE id = ?', [courseId]);
  if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  const enrollment = assertEnrolled(await getEnrollmentOrNull(userId, courseId));

  const totals = await get(
    `SELECT COUNT(*) AS n FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ?`,
    [courseId],
  );
  const completedRows = await all(
    `SELECT lp.lesson_id, lp.completed_at
       FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN modules m ON m.id = l.module_id
      WHERE lp.user_id = ? AND m.course_id = ?
      ORDER BY lp.completed_at ASC`,
    [userId, courseId],
  );

  return {
    courseId,
    progressPercent: totals.n ? Math.round((completedRows.length / totals.n) * 100) : 0,
    lessonsCompleted: completedRows.length,
    lessonsTotal: totals.n,
    lastAccessedLessonId: enrollment.last_lesson_id ?? (completedRows.at(-1)?.lesson_id ?? null),
    completedLessons: completedRows.map((r) => r.lesson_id),
    startedAt: enrollment.enrolled_at,
    completedAt: enrollment.completed_at ?? null,
  };
}

export async function issueCertificate(user, courseId) {
  const course = await get('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!course || !course.is_published) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  assertEnrolled(await getEnrollmentOrNull(user.id, courseId));
  const percent = await progressPercentFor(user.id, courseId);
  if (percent < 100) {
    throw new ApiError(409, 'CONFLICT', 'Course is not yet completed');
  }
  const existing = await get(
    'SELECT * FROM certificates WHERE user_id = ? AND course_id = ?',
    [user.id, courseId],
  );
  if (existing) return existing;
  const id = `cert-${crypto.randomUUID()}`;
  await run('INSERT INTO certificates (id, user_id, course_id) VALUES (?, ?, ?)', [
    id,
    user.id,
    courseId,
  ]);
  return get('SELECT * FROM certificates WHERE id = ?', [id]);
}

export function serializeCertificate(row) {
  return {
    certificateId: row.id,
    issuedAt: row.issued_at,
  };
}
