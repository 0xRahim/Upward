import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  adminListEnrollments,
  cancelEnrollment,
  enroll,
  listMyEnrollments,
} from './service.js';

export const enrollmentsRouter = Router();

const createBody = z
  .object({
    courseId: z.string().uuid().optional(),
    bundleId: z.string().uuid().optional(),
  })
  .refine((v) => !!v.courseId !== !!v.bundleId, {
    message: 'Provide exactly one of courseId or bundleId',
  });

const listMineQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'completed']).optional(),
  type: z.enum(['course', 'bundle']).optional(),
});

enrollmentsRouter.use(authenticate);

enrollmentsRouter.post('/', validate({ body: createBody }), async (req, res) => {
  res.status(201).json(await enroll(req.user, req.body));
});

enrollmentsRouter.get(
  '/me',
  validate({ query: listMineQuery }),
  async (req, res) => {
    res.json(await listMyEnrollments(req.user.id, req.validatedQuery));
  },
);

enrollmentsRouter.delete('/:enrollmentId', async (req, res) => {
  await cancelEnrollment(req.params.enrollmentId, req.user);
  res.status(204).end();
});

// Admin
export const adminEnrollmentsRouter = Router();
adminEnrollmentsRouter.use(authenticate, requireAdmin);

const adminListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  status: z.enum(['active', 'completed']).optional(),
});

adminEnrollmentsRouter.get('/enrollments', validate({ query: adminListQuery }), async (req, res) => {
  res.json(await adminListEnrollments(req.validatedQuery));
});
