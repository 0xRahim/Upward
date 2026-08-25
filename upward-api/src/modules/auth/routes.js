import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { passwordSchema } from '../../utils/schemas.js';
import { login, refresh, register } from './service.js';

export const authRouter = Router();

const registerBody = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(254),
  password: passwordSchema,
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshBody = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post(
  '/register',
  rateLimit({ windowMs: 60_000, max: 3, name: 'auth-register' }),
  validate({ body: registerBody }),
  async (req, res) => {
    const user = await register(req.body);
    res.status(201).json(user);
  },
);

authRouter.post(
  '/login',
  rateLimit({ windowMs: 60_000, max: 5, name: 'auth-login' }),
  validate({ body: loginBody }),
  async (req, res) => {
    res.json(await login(req.body));
  },
);

authRouter.post('/refresh', validate({ body: refreshBody }), async (req, res) => {
  res.json(await refresh(req.body.refreshToken));
});

authRouter.post(
  '/logout',
  authenticate,
  validate({ body: refreshBody }),
  async (req, res) => {
    await logout(req.user.id, req.body.refreshToken);
    res.status(204).end();
  },
);
