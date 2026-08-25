import { get } from '../db/database.js';

export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function uniqueSlug(table, base, ignoreId = null) {
  const clean = slugify(base) || 'item';
  let candidate = clean;
  let suffix = 1;
  for (;;) {
    const params = ignoreId ? [candidate, ignoreId] : [candidate];
    const row = await get(
      `SELECT id FROM ${table} WHERE slug = ?${ignoreId ? ' AND id <> ?' : ''}`,
      params,
    );
    if (!row) return candidate;
    suffix += 1;
    candidate = `${clean}-${suffix}`;
  }
}
