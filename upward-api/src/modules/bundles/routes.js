import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createBundle,
  deleteBundle,
  getBundleByIdOrSlug,
  listBundles,
  updateBundle,
} from './service.js';

export const bundlesRouter = Router();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(120).optional(),
});

const createBody = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10),
  courseIds: z.array(z.string().uuid()).min(2),
  coverImageUrl: z.string().url().max(2048).optional(),
  isPublished: z.boolean().optional(),
});

const updateBody = z
  .object({
    title: z.string().min(3).max(120).optional(),
    description: z.string().min(10).optional(),
    courseIds: z.array(z.string().uuid()).min(2).optional(),
    coverImageUrl: z.string().url().max(2048).nullable().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

bundlesRouter.get('/', validate({ query: listQuery }), async (req, res) => {
  res.json(await listBundles(req.validatedQuery));
});

bundlesRouter.get('/:idOrSlug', async (req, res) => {
  res.json(await getBundleByIdOrSlug(req.params.idOrSlug));
});

bundlesRouter.post(
  '/',
  authenticate,
  requireAdmin,
  validate({ body: createBody }),
  async (req, res) => {
    res.status(201).json(await createBundle(req.body));
  },
);

bundlesRouter.patch(
  '/:bundleId',
  authenticate,
  requireAdmin,
  validate({ body: updateBody }),
  async (req, res) => {
    res.json(await updateBundle(req.params.bundleId, req.body));
  },
);

bundlesRouter.delete('/:bundleId', authenticate, requireAdmin, async (req, res) => {
  await deleteBundle(req.params.bundleId);
  res.status(204).end();
});
