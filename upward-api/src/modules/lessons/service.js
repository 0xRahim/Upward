import crypto from 'node:crypto';
import { all, get, run } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';
import { getEnrollmentOrNull } from '../enrollments/service.js';

export function serializeLesson(row) {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    type: row.type,
    contentUrl: row.content_url ?? null,
    content: row.content ?? null,
    durationMinutes: row.duration_minutes ?? null,
    position: row.position,
    isPreviewable: !!row.is_previewable,
  };
}

function assertTypeRequirements(lesson) {
  if (lesson.type === 'video') {
    if (!lesson.content_url) {
      throw new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Video lessons require a contentUrl', [
        { field: 'contentUrl', issue: 'is required for video lessons' },
      ]);
    }
    if (lesson.duration_minutes == null) {
      throw new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Video lessons require durationMinutes', [
        { field: 'durationMinutes', issue: 'is required for video lessons' },
      ]);
    }
  }
  if (lesson.type === 'text' && !lesson.content) {
    throw new ApiError(422, 'UNPROCESSABLE_ENTITY', 'Text lessons require content', [
      { field: 'content', issue: 'is required for text lessons' },
    ]);
  }
}

async function getLessonRow(lessonId) {
  const lesson = await get('SELECT * FROM lessons WHERE id = ?', [lessonId]);
  if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found');
  return lesson;
}

export async function createLesson(moduleId, body) {
  const module = await get('SELECT * FROM modules WHERE id = ?', [moduleId]);
  if (!module) throw new ApiError(404, 'NOT_FOUND', 'Module not found');
  let position = body.position;
  if (position === undefined) {
    const max = await get(
      'SELECT COALESCE(MAX(position), 0) AS m FROM lessons WHERE module_id = ?',
      [moduleId],
    );
    position = max.m + 1;
  } else {
    await run(
      'UPDATE lessons SET position = position + 1 WHERE module_id = ? AND position >= ?',
      [moduleId, position],
    );
  }
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO lessons (id, module_id, title, type, content_url, content, duration_minutes, position, is_previewable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      moduleId,
      body.title,
      body.type,
      body.contentUrl ?? null,
      body.content ?? null,
      body.durationMinutes ?? null,
      position,
      body.isPreviewable ? 1 : 0,
    ],
  );
  const lesson = await getLessonRow(id);
  assertTypeRequirements(lesson);
  return serializeLesson(lesson);
}

export async function updateLesson(lessonId, patch) {
  const existing = await getLessonRow(lessonId);
  const merged = {
    title: patch.title ?? existing.title,
    type: patch.type ?? existing.type,
    content_url: patch.contentUrl !== undefined ? patch.contentUrl : existing.content_url,
    content: patch.content !== undefined ? patch.content : existing.content,
    duration_minutes:
      patch.durationMinutes !== undefined ? patch.durationMinutes : existing.duration_minutes,
    is_previewable:
      patch.isPreviewable !== undefined ? (patch.isPreviewable ? 1 : 0) : existing.is_previewable,
  };
  assertTypeRequirements(merged);
  const sets = [];
  const params = [];
  for (const [column, value] of Object.entries({
    title: merged.title,
    type: merged.type,
    content_url: merged.content_url,
    content: merged.content,
    duration_minutes: merged.duration_minutes,
    is_previewable: merged.is_previewable,
  })) {
    sets.push(`${column} = ?`);
    params.push(value);
  }
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  if (patch.position !== undefined && patch.position !== existing.position) {
    // Reorder within the module
    const rows = await all(
      'SELECT id FROM lessons WHERE module_id = ? AND id <> ? ORDER BY position ASC',
      [existing.module_id, lessonId],
    );
    const idx = Math.min(Math.max(patch.position - 1, 0), rows.length);
    rows.splice(idx, 0, { id: lessonId });
    for (let i = 0; i < rows.length; i++) {
      await run('UPDATE lessons SET position = ? WHERE id = ?', [i + 1, rows[i].id]);
    }
  }
  await run(`UPDATE lessons SET ${sets.join(', ')} WHERE id = ?`, [...params, lessonId]);
  return serializeLesson(await getLessonRow(lessonId));
}

export async function deleteLesson(lessonId) {
  const existing = await getLessonRow(lessonId);
  await run('DELETE FROM lessons WHERE id = ?', [existing.id]);
}

export async function getLessonContent(user, lessonId) {
  const lesson = await get(
    `SELECT l.*, m.course_id
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
      WHERE l.id = ?`,
    [lessonId],
  );
  if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found');

  const isAdmin = user.role === 'admin';
  let enrollment = null;
  if (!isAdmin) {
    enrollment = await getEnrollmentOrNull(user.id, lesson.course_id);
    if (!enrollment && !lesson.is_previewable) {
      throw new ApiError(
        403,
        'NOT_ENROLLED',
        'You must be enrolled in the course to access this lesson',
      );
    }
  }

  if (enrollment) {
    await run('UPDATE enrollments SET last_lesson_id = ? WHERE id = ?', [
      lessonId,
      enrollment.id,
    ]);
  }

  const progress = enrollment
    ? await get('SELECT completed_at FROM lesson_progress WHERE user_id = ? AND lesson_id = ?', [
        user.id,
        lessonId,
      ])
    : null;

  return {
    ...serializeLesson(lesson),
    courseId: lesson.course_id,
    completed: !!progress,
  };
}
