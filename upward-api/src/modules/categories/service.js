import { all, get, run } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';
import { uniqueSlug } from '../../utils/slug.js';

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    courseCount: row.course_count ?? row.n ?? undefined,
  };
}

export function serializeCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    courseCount: Number(row.course_count ?? 0),
  };
}

export async function listCategories() {
  const rows = await all(
    `SELECT c.*, COUNT(co.id) AS course_count
       FROM categories c
       LEFT JOIN courses co ON co.category_id = c.id AND co.is_published = 1
      GROUP BY c.id
      ORDER BY c.name ASC`,
  );
  return { data: rows.map(serializeCategory) };
}

export async function getCategoryOr404(categoryId) {
  const row = await get('SELECT * FROM categories WHERE id = ?', [categoryId]);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Category not found');
  return row;
}

export async function createCategory({ name }) {
  const slug = await uniqueSlug('categories', name);
  const id = crypto.randomUUID();
  await run('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [id, name, slug]);
  return serializeCategory(await get('SELECT * FROM categories WHERE id = ?', [id]));
}

export async function updateCategory(categoryId, { name }) {
  const existing = await getCategoryOr404(categoryId);
  if (name !== undefined && name !== existing.name) {
    const slug = await uniqueSlug('categories', name, categoryId);
    await run('UPDATE categories SET name = ?, slug = ?, updated_at = ? WHERE id = ?', [
      name,
      slug,
      new Date().toISOString(),
      categoryId,
    ]);
  }
  return serializeCategory(await get('SELECT * FROM categories WHERE id = ?', [categoryId]));
}

export async function deleteCategory(categoryId) {
  const existing = await getCategoryOr404(categoryId);
  const count = await get('SELECT COUNT(*) AS n FROM courses WHERE category_id = ?', [
    categoryId,
  ]);
  if (count.n > 0) {
    throw new ApiError(
      409,
      'CONFLICT',
      `Category still contains ${count.n} course(s) and cannot be deleted`,
    );
  }
  await run('DELETE FROM categories WHERE id = ?', [existing.id]);
}
