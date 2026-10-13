import { z } from 'zod';

export const BidRequestSchema = z.object({
  auction_id: z.string().trim().min(1, 'auction_id is required'),
  user_id: z.string().trim().min(1, 'user_id is required'),
  amount: z
    .number({ invalid_type_error: 'amount must be a number' })
    .positive('amount must be positive')
    .finite('amount must be finite'),
  idempotency_key: z.string().trim().min(1).optional(),
});

export type BidRequest = z.infer<typeof BidRequestSchema>;
