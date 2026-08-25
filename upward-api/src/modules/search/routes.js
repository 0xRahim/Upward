import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { globalSearch, suggest } from './service.js';

export const searchRouter = Router();

const searchQuery = z.object({
  q: z.string().max(200),
  type: z.enum(['course', 'bundle']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

const suggestQuery = z.object({
  q: z.string().max(200),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

searchRouter.get('/', validate({ query: searchQuery }), async (req, res) => {
  res.json(await globalSearch(req.validatedQuery));
});

searchRouter.get('/suggest', validate({ query: suggestQuery }), async (req, res) => {
  res.json(await suggest(req.validatedQuery));
});
