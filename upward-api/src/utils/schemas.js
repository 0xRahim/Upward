import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'must be at least 8 characters')
  .regex(/[A-Z]/, 'must contain at least one uppercase letter')
  .regex(/\d/, 'must contain at least one number');

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const boolish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true'));
