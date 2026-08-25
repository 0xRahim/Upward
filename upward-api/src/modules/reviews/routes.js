import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createReview,
  deleteReview,
  listReviews,
  toggleHelpful,
  updateReview,
} from './service.js';

export const reviewsRouter = Router();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['helpfulVotes', '-helpfulVotes', 'newest', '-createdAt'])
    .default('newest'),
});

const createBody = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

const updateBody = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    comment: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

reviewsRouter.get(
  '/courses/:courseId/reviews',
  validate({ query: listQuery }),
  async (req, res) => {
    res.json(await listReviews(req.params.courseId, req.validatedQuery, req.user?.id));
  },
);

reviewsRouter.post(
  '/courses/:courseId/reviews',
  authenticate,
  validate({ body: createBody }),
  async (req, res) => {
    res.status(201).json(await createReview(req.user, req.params.courseId, req.body));
  },
);

const ownerRouter = Router();
ownerRouter.use(authenticate);

ownerRouter.patch('/reviews/:reviewId', validate({ body: updateBody }), async (req, res) => {
  res.json(await updateReview(req.params.reviewId, req.user.id, req.body));
});

ownerRouter.delete('/reviews/:reviewId', async (req, res) => {
  await deleteReview(req.params.reviewId, req.user);
  res.status(204).end();
});

ownerRouter.post('/reviews/:reviewId/helpful', async (req, res) => {
  res.json(await toggleHelpful(req.params.reviewId, req.user.id));
});

reviewsRouter.use(ownerRouter);
