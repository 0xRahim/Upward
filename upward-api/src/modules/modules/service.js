import crypto from 'node:crypto';
import { all, get, run } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';

export function serializeModule(row, lessons = []) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    position: row.position,
    lessons,
  };
}

export async function getModuleOr404(moduleId) {
  const row = await get('SELECT * FROM modules WHERE id = ?', [moduleId]);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Module not found');
  return row;
}

function serializeLessons(rows) {
  return rows.map((l) => ({
    id: l.id,
    title: l.title,
    type: l.type,
    durationMinutes: l.duration_minutes ?? null,
    position: l.position,
    isPreviewable: !!l.is_previewable,
  }));
}

async function moduleLessons(moduleId) {
  const rows = await all(
    'SELECT * FROM lessons WHERE module_id = ? ORDER BY position ASC',
    [moduleId],
  );
  return serializeLessons(rows);
}

async function normalizePositions(courseId) {
  const rows = await all(
    'SELECT id FROM modules WHERE course_id = ? ORDER BY position ASC, created_at ASC',
    [courseId],
  );
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].position !== i + 1) {
      await run('UPDATE modules SET position = ? WHERE id = ?', [i + 1, rows[i].id]);
    }
  }
}

export async function createModule(courseId, { title, position }) {
  const course = await get('SELECT id FROM courses WHERE id = ?', [courseId]);
  if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  let finalPosition = position;
  if (finalPosition === undefined) {
    const max = await get(
      'SELECT COALESCE(MAX(position), 0) AS m FROM modules WHERE course_id = ?',
      [courseId],
    );
    finalPosition = max.m + 1;
  } else {
    await run(
      'UPDATE modules SET position = position + 1 WHERE course_id = ? AND position >= ?',
      [courseId, finalPosition],
    );
  }
  const id = crypto.randomUUID();
  await run('INSERT INTO modules (id, course_id, title, position) VALUES (?, ?, ?, ?)', [
    id,
    courseId,
    title,
    finalPosition,
  ]);
  return serializeModule(await getModuleOr404(id));
}

export async function updateModule(moduleId, patch) {
  const existing = await getModuleOr404(moduleId);
  if (patch.title !== undefined) {
    await run('UPDATE modules SET title = ?, updated_at = ? WHERE id = ?', [
      patch.title,
      new Date().toISOString(),
      moduleId,
    ]);
  }
  if (patch.position !== undefined && patch.position !== existing.position) {
    // Move out of the way, then re-normalize ordering within the course.
    await run('UPDATE modules SET position = -1 WHERE id = ?', [moduleId]);
    if (patch.position < existing.position) {
      await run(
        'UPDATE modules SET position = position + 1 WHERE course_id = ? AND position >= ? AND position < ?',
        [existing.course_id, patch.position, existing.position],
      );
    } else {
      await run(
        'UPDATE modules SET position = position - 1 WHERE course_id = ? AND position > ? AND position <= ?',
        [existing.course_id, existing.position, patch.position],
      );
    }
    await run('UPDATE modules SET position = ? WHERE id = ?', [
      Math.max(1, patch.position),
      moduleId,
    ]);
    await normalizePositions(existing.course_id);
  }
  return serializeModule(await getModuleOr404(moduleId), await moduleLessons(moduleId));
}

export async function deleteModule(moduleId) {
  const existing = await getModuleOr404(moduleId);
  await run('DELETE FROM modules WHERE id = ?', [moduleId]);
  await normalizePositions(existing.course_id);
}
