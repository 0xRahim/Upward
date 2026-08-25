import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  getCourseProgress,
  issueCertificate,
  markLessonComplete,
  markLessonIncomplete,
  serializeCertificate,
} from './service.js';

export const progressRouter = Router();

progressRouter.use(authenticate);

progressRouter.post('/lessons/:lessonId/complete', async (req, res) => {
  res.json(await markLessonComplete(req.user, req.params.lessonId));
});

progressRouter.delete('/lessons/:lessonId/complete', async (req, res) => {
  res.json(await markLessonIncomplete(req.user, req.params.lessonId));
});

progressRouter.get('/courses/:courseId', async (req, res) => {
  res.json(await getCourseProgress(req.user.id, req.params.courseId));
});

progressRouter.post('/courses/:courseId/certificate', async (req, res) => {
  const cert = await issueCertificate(req.user, req.params.courseId);
  res.json({
    ...serializeCertificate(cert),
    certificateUrl: `${req.protocol}://${req.get('host')}/v1/certificates/${cert.id}/download`,
  });
});
