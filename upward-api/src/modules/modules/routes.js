import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { deleteModule, updateModule } from './service.js';

export const modulesRouter = Router();

const updateBody = z
  .object({
    title: z.string().min(2).max(120).optional(),
    position: z.coerce.number().int().min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

modulesRouter.use(authenticate, requireAdmin);

modulesRouter.patch('/:moduleId', validate({ body: updateBody }), async (req, res) => {
  res.json(await updateModule(req.params.moduleId, req.body));
});

modulesRouter.delete('/:moduleId', async (req, res) => {
  await deleteModule(req.params.moduleId);
  res.status(204).end();
});
