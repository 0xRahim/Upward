import { Router } from 'express';
import { get } from '../../db/database.js';
import { authenticate } from '../../middleware/auth.js';
import { ApiError } from '../../utils/httpError.js';
import { serializeCertificate } from '../progress/service.js';

export const certificatesRouter = Router();

certificatesRouter.get('/:certificateId/download', authenticate, async (req, res) => {
  const cert = await get('SELECT * FROM certificates WHERE id = ?', [req.params.certificateId]);
  if (!cert || (cert.user_id !== req.user.id && req.user.role !== 'admin')) {
    throw new ApiError(404, 'NOT_FOUND', 'Certificate not found');
  }
  const course = await get('SELECT title FROM courses WHERE id = ?', [cert.course_id]);
  res.json({
    ...serializeCertificate(cert),
    course: { id: cert.course_id, title: course?.title ?? null },
    recipient: { id: cert.user_id, name: req.user.id === cert.user_id ? req.user.name : undefined },
    certificateUrl: `${req.protocol}://${req.get('host')}/v1/certificates/${cert.id}/download`,
  });
});
