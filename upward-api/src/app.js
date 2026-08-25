import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { rateLimit } from './middleware/rateLimit.js';
import { authRouter } from './modules/auth/routes.js';
import { bundlesRouter } from './modules/bundles/routes.js';
import { categoriesRouter } from './modules/categories/routes.js';
import { certificatesRouter } from './modules/certificates/routes.js';
import { coursesRouter } from './modules/courses/routes.js';
import {
  adminEnrollmentsRouter,
  enrollmentsRouter,
} from './modules/enrollments/routes.js';
import { lessonsRouter } from './modules/lessons/routes.js';
import { modulesRouter } from './modules/modules/routes.js';
import { progressRouter } from './modules/progress/routes.js';
import { reviewsRouter } from './modules/reviews/routes.js';
import { searchRouter } from './modules/search/routes.js';
import { usersRouter } from './modules/users/routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Allow any localhost origin (any port) + non-browser clients.
  // Swap for an env-based whitelist when deploying to production.
  app.use(
    cors({
      origin(origin, cb) {
        const allowed =
          !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
        cb(null, allowed);
      },
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, max: 100, name: 'general' }));

  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/categories', categoriesRouter);
  api.use('/courses', coursesRouter);
  api.use('/modules', modulesRouter);
  api.use(lessonsRouter);
  api.use('/bundles', bundlesRouter);
  api.use('/enrollments', enrollmentsRouter);
  api.use('/admin', adminEnrollmentsRouter);
  api.use('/progress', progressRouter);
  api.use(reviewsRouter);
  api.use('/search', searchRouter);
  api.use('/certificates', certificatesRouter);

  app.use('/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
