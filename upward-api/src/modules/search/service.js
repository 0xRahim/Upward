import { all, get } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text, q) {
  if (!text) return null;
  return text.replace(new RegExp(escapeRegExp(q), 'gi'), (m) => `<em>${m}</em>`);
}

function snippet(text, q, radius = 60) {
  if (!text) return null;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  const raw =
    (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
  return highlight(raw, q);
}

export async function globalSearch(query) {
  if (!query.q || query.q.trim().length < 2) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
      { field: 'q', issue: 'must be at least 2 characters' },
    ]);
  }
  const like = `%${query.q}%`;
  const wantCourses = !query.type || query.type === 'course';
  const wantBundles = !query.type || query.type === 'bundle';

  let courses = [];
  let bundles = [];
  let courseTotal = { n: 0 };
  let bundleTotal = { n: 0 };

  if (wantCourses) {
    courseTotal = await get(
      `SELECT COUNT(*) AS n FROM courses WHERE is_published = 1 AND (title LIKE ? OR description LIKE ?)`,
      [like, like],
    );
    courses = await all(
      `SELECT id, slug, title, description, rating
         FROM courses
        WHERE is_published = 1 AND (title LIKE ? OR description LIKE ?)
        ORDER BY rating DESC
        LIMIT ? OFFSET ?`,
      [like, like, query.limit, query.offset],
    );
  }
  if (wantBundles) {
    bundleTotal = await get(
      `SELECT COUNT(*) AS n FROM bundles WHERE is_published = 1 AND (title LIKE ? OR description LIKE ?)`,
      [like, like],
    );
    bundles = await all(
      `SELECT id, slug, title, description
         FROM bundles
        WHERE is_published = 1 AND (title LIKE ? OR description LIKE ?)
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
      [like, like, query.limit, query.offset],
    );
  }

  return {
    query: query.q,
    results: {
      courses: courses.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        highlightedTitle: highlight(c.title, query.q),
        snippet: snippet(c.description, query.q),
        rating: c.rating,
      })),
      bundles: bundles.map((b) => ({
        id: b.id,
        slug: b.slug,
        title: b.title,
        highlightedTitle: highlight(b.title, query.q),
        snippet: snippet(b.description, query.q),
      })),
    },
    total: { courses: courseTotal.n, bundles: bundleTotal.n },
  };
}

export async function suggest({ q, limit }) {
  if (!q || q.trim().length < 1) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
      { field: 'q', issue: 'is required' },
    ]);
  }
  const like = `%${q}%`;
  const suggestions = [];
  const courses = await all(
    `SELECT slug, title FROM courses WHERE is_published = 1 AND title LIKE ? ORDER BY student_count DESC LIMIT ?`,
    [like, limit],
  );
  for (const c of courses) suggestions.push({ type: 'course', label: c.title, slug: c.slug });
  const remaining = limit - suggestions.length;
  if (remaining > 0) {
    const categories = await all(
      `SELECT slug, name FROM categories WHERE name LIKE ? ORDER BY name ASC LIMIT ?`,
      [like, remaining],
    );
    for (const c of categories) suggestions.push({ type: 'category', label: c.name, slug: c.slug });
  }
  const stillRemaining = limit - suggestions.length;
  if (stillRemaining > 0) {
    const bundles = await all(
      `SELECT slug, title FROM bundles WHERE is_published = 1 AND title LIKE ? ORDER BY created_at DESC LIMIT ?`,
      [like, stillRemaining],
    );
    for (const b of bundles) suggestions.push({ type: 'bundle', label: b.title, slug: b.slug });
  }
  return { suggestions };
}
