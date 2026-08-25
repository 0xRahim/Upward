import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createModule } from '../modules/service.js';
import {
  createCourse,
  deleteCourse,
  getCourseRowByIdOrSlug,
  listCourses,
  serializeCourse,
  serializeOutline,
  updateCourse,
} from './service.js';

export const coursesRouter = Router();

const levelEnum = z.enum(['beginner', 'intermediate', 'advanced']);

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().max(120).optional(),
  level: levelEnum.optional(),
  sort: z.enum(['title', '-title', 'rating', '-rating', 'newest']).default('newest'),
  search: z.string().max(120).optional(),
});

const createBody = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(20),
  categoryId: z.string().uuid(),
  level: levelEnum.optional(),
  coverImageUrl: z.string().url().max(2048).optional(),
  isPublished: z.boolean().optional(),
});

const updateBody = z
  .object({
    title: z.string().min(3).max(120).optional(),
    description: z.string().min(20).optional(),
    categoryId: z.string().uuid().optional(),
    level: levelEnum.optional(),
    coverImageUrl: z.string().url().max(2048).nullable().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

const createModuleBody = z.object({
  title: z.string().min(2).max(120),
  position: z.coerce.number().int().min(1).optional(),
});

coursesRouter.get('/', validate({ query: listQuery }), async (req, res) => {
  res.json(await listCourses(req.validatedQuery));
});

coursesRouter.get('/:idOrSlug', async (req, res) => {
  const row = await getCourseRowByIdOrSlug(req.params.idOrSlug);
  const modules = await serializeOutline(row.id);
  res.json({ ...serializeCourse(row), modules });
});

coursesRouter.post(
  '/',
  authenticate,
  requireAdmin,
  validate({ body: createBody }),
  async (req, res) => {
    res.status(201).json(await createCourse(req.body));
  },
);

coursesRouter.patch(
  '/:courseId',
  authenticate,
  requireAdmin,
  validate({ body: updateBody }),
  async (req, res) => {
    res.json(await updateCourse(req.params.courseId, req.body));
  },
);

coursesRouter.delete('/:courseId', authenticate, requireAdmin, async (req, res) => {
  const force = req.query.force === 'true';
  await deleteCourse(req.params.courseId, force);
  res.status(204).end();
});

// Nested under a course
coursesRouter.post(
  '/:courseId/modules',
  authenticate,
  requireAdmin,
  validate({ body: createModuleBody }),
  async (req, res) => {
    const course = await getCourseRowByIdOrSlug(req.params.courseId, { includeDrafts: true });
    res.status(201).json(await createModule(course.id, req.body));
  },
);
