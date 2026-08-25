import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { boolish } from '../../utils/schemas.js';
import {
  createLesson,
  deleteLesson,
  getLessonContent,
  updateLesson,
} from './service.js';

export const lessonsRouter = Router();

const createBody = z
  .object({
    title: z.string().min(2).max(200),
    type: z.enum(['video', 'text', 'quiz']),
    contentUrl: z.string().url().max(2048).optional(),
    content: z.string().max(100_000).optional(),
    durationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    position: z.coerce.number().int().min(1).optional(),
    isPreviewable: boolish.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'video') {
      if (!val.contentUrl) {
        ctx.addIssue({
          code: 'custom',
          path: ['contentUrl'],
          message: 'is required for video lessons',
        });
      }
      if (val.durationMinutes === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['durationMinutes'],
          message: 'is required for video lessons',
        });
      }
    }
    if (val.type === 'text' && !val.content) {
      ctx.addIssue({
        code: 'custom',
        path: ['content'],
        message: 'is required for text lessons',
      });
    }
  });

const updateBody = z
  .object({
    title: z.string().min(2).max(200).optional(),
    type: z.enum(['video', 'text', 'quiz']).optional(),
    contentUrl: z.string().url().max(2048).nullable().optional(),
    content: z.string().max(100_000).nullable().optional(),
    durationMinutes: z.coerce.number().int().min(1).max(1440).nullable().optional(),
    position: z.coerce.number().int().min(1).optional(),
    isPreviewable: boolish.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

lessonsRouter.post(
  '/modules/:moduleId/lessons',
  authenticate,
  requireAdmin,
  validate({ body: createBody }),
  async (req, res) => {
    res.status(201).json(await createLesson(req.params.moduleId, req.body));
  },
);

lessonsRouter.patch(
  '/lessons/:lessonId',
  authenticate,
  requireAdmin,
  validate({ body: updateBody }),
  async (req, res) => {
    res.json(await updateLesson(req.params.lessonId, req.body));
  },
);

lessonsRouter.delete('/lessons/:lessonId', authenticate, requireAdmin, async (req, res) => {
  await deleteLesson(req.params.lessonId);
  res.status(204).end();
});

lessonsRouter.get('/lessons/:lessonId/content', authenticate, async (req, res) => {
  res.json(await getLessonContent(req.user, req.params.lessonId));
});
