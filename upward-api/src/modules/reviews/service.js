import crypto from 'node:crypto';
import { all, get, run } from '../../db/database.js';
import { ApiError } from '../../utils/httpError.js';
import { offset, paginateMeta } from '../../utils/paginate.js';

export async function recomputeCourseAggregates(courseId) {
  const agg = await get(
    'SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS n FROM reviews WHERE course_id = ?',
    [courseId],
  );
  await run('UPDATE courses SET rating = ?, review_count = ?, updated_at = ? WHERE id = ?', [
    Math.round(agg.avg_rating * 10) / 10,
    agg.n,
    new Date().toISOString(),
    courseId,
  ]);
}

async function getReviewOr404(reviewId) {
  const row = await get(
    `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?`,
    [reviewId],
  );
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Review not found');
  return row;
}

async function serialize(row, viewerId) {
  const review = {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    comment: row.comment ?? null,
    helpfulVotes: row.helpful_votes,
    createdAt: row.created_at,
  };
  if (viewerId !== undefined) {
    const vote = await get(
      'SELECT 1 AS v FROM review_votes WHERE review_id = ? AND user_id = ?',
      [row.id, viewerId],
    );
    review.votedByMe = !!vote;
  }
  return review;
}

export async function listReviews(courseId, query, viewerId) {
  const course = await get('SELECT id, is_published FROM courses WHERE id = ?', [courseId]);
  if (!course || !course.is_published) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  const sorts = {
    helpfulVotes: 'helpful_votes ASC',
    '-helpfulVotes': 'helpful_votes DESC',
    newest: 'created_at DESC',
    '-createdAt': 'created_at ASC',
  };
  const orderBy = sorts[query.sort] ?? sorts.newest;
  const total = await get('SELECT COUNT(*) AS n FROM reviews WHERE course_id = ?', [courseId]);
  const rows = await all(
    `SELECT r.*, u.name AS user_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
      WHERE r.course_id = ?
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    [courseId, query.perPage, offset(query.page, query.perPage)],
  );
  const data = [];
  for (const row of rows) data.push(await serialize(row, viewerId));
  return { data, meta: paginateMeta(query.page, query.perPage, total.n) };
}

export async function createReview(user, courseId, body) {
  const course = await get('SELECT * FROM courses WHERE id = ? AND is_published = 1', [courseId]);
  if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  const enrollment = await get(
    "SELECT * FROM enrollments WHERE user_id = ? AND course_id = ? AND status IN ('active', 'completed')",
    [user.id, courseId],
  );
  if (!enrollment) {
    throw new ApiError(403, 'FORBIDDEN', 'You must be enrolled to review this course');
  }
  const done = await get(
    `SELECT COUNT(*) AS n
       FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN modules m ON m.id = l.module_id
      WHERE lp.user_id = ? AND m.course_id = ?`,
    [user.id, courseId],
  );
  if (!done.n) {
    throw new ApiError(403, 'FORBIDDEN', 'Complete at least one lesson before reviewing this course');
  }
  const existing = await get('SELECT id FROM reviews WHERE course_id = ? AND user_id = ?', [
    courseId,
    user.id,
  ]);
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_RESOURCE', 'You have already reviewed this course');
  }
  const id = crypto.randomUUID();
  await run(
    'INSERT INTO reviews (id, course_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [id, courseId, user.id, body.rating, body.comment ?? null],
  );
  await recomputeCourseAggregates(courseId);
  return serialize(await getReviewOr404(id));
}

export async function updateReview(reviewId, userId, body) {
  const existing = await getReviewOr404(reviewId);
  if (existing.user_id !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'You can only edit your own reviews');
  }
  const rating = body.rating ?? existing.rating;
  const comment = body.comment !== undefined ? body.comment : existing.comment;
  await run('UPDATE reviews SET rating = ?, comment = ?, updated_at = ? WHERE id = ?', [
    rating,
    comment,
    new Date().toISOString(),
    reviewId,
  ]);
  await recomputeCourseAggregates(existing.course_id);
  return serialize(await getReviewOr404(reviewId), userId);
}

export async function deleteReview(reviewId, user) {
  const existing = await getReviewOr404(reviewId);
  if (existing.user_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'You can only delete your own reviews');
  }
  await run('DELETE FROM reviews WHERE id = ?', [reviewId]);
  await recomputeCourseAggregates(existing.course_id);
}

export async function toggleHelpful(reviewId, userId) {
  const review = await getReviewOr404(reviewId);
  const vote = await get('SELECT 1 AS v FROM review_votes WHERE review_id = ? AND user_id = ?', [
    reviewId,
    userId,
  ]);
  if (vote) {
    await run('DELETE FROM review_votes WHERE review_id = ? AND user_id = ?', [reviewId, userId]);
  } else {
    await run('INSERT INTO review_votes (review_id, user_id) VALUES (?, ?)', [reviewId, userId]);
  }
  const count = await get('SELECT COUNT(*) AS n FROM review_votes WHERE review_id = ?', [reviewId]);
  await run('UPDATE reviews SET helpful_votes = ? WHERE id = ?', [count.n, reviewId]);
  return { helpfulVotes: count.n, votedByMe: !vote };
}
