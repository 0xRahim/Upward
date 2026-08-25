import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { adminDeleteUser, adminListUsers, adminUpdateUser, getMe, updateMe } from './service.js';
import { changePassword } from '../auth/service.js';
import { passwordSchema } from '../../utils/schemas.js';

export const usersRouter = Router();

const updateMeBody = z.object({
  name: z.string().min(2).max(80).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
});

const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['user', 'admin']).optional(),
  search: z.string().max(120).optional(),
});

const adminUpdateUserBody = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    isActive: z.boolean().optional(),
    name: z.string().min(2).max(80).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

usersRouter.use(authenticate);

usersRouter.get('/me', async (req, res) => {
  res.json(await getMe(req.user.id));
});

usersRouter.patch('/me', validate({ body: updateMeBody }), async (req, res) => {
  res.json(await updateMe(req.user.id, req.body));
});

const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

usersRouter.post(
  '/me/change-password',
  validate({ body: changePasswordBody }),
  async (req, res) => {
    await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.json({ message: 'Password changed successfully' });
  },
);

// Admin endpoints (declared after /me so they don't shadow it)
const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get('/', validate({ query: listUsersQuery }), async (req, res) => {
  res.json(await adminListUsers(req.validatedQuery));
});

adminRouter.patch('/:userId', validate({ body: adminUpdateUserBody }), async (req, res) => {
  res.json(await adminUpdateUser(req.params.userId, req.body, req.user.id));
});

adminRouter.delete('/:userId', async (req, res) => {
  await adminDeleteUser(req.params.userId, req.user.id);
  res.status(204).end();
});

usersRouter.use(adminRouter);
