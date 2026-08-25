import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from './service.js';

export const categoriesRouter = Router();

const createBody = z.object({
  name: z.string().min(2).max(80),
});

const updateBody = z.object({
  name: z.string().min(2).max(80),
});

categoriesRouter.get('/', async (_req, res) => {
  res.json(await listCategories());
});

categoriesRouter.post(
  '/',
  authenticate,
  requireAdmin,
  validate({ body: createBody }),
  async (req, res) => {
    res.status(201).json(await createCategory(req.body));
  },
);

categoriesRouter.patch(
  '/:categoryId',
  authenticate,
  requireAdmin,
  validate({ body: updateBody }),
  async (req, res) => {
    res.json(await updateCategory(req.params.categoryId, req.body));
  },
);

categoriesRouter.delete(
  '/:categoryId',
  authenticate,
  requireAdmin,
  async (req, res) => {
    await deleteCategory(req.params.categoryId);
    res.status(204).end();
  },
);
