import { Request, Response } from 'express';
import { BidRequestSchema } from '../validators/bid.schema';
import { processBid } from '../services/bid.service';

export async function placeBid(req: Request, res: Response): Promise<void> {
  const parsed = BidRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request body',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await processBid(parsed.data);

    if (result.accepted === true) {
      res.status(201).json({
        success: true,
        bid_id: result.bid_id,
        current_bid: result.current_bid,
        current_bidder_id: result.current_bidder_id,
      });
      return;
    }

    if (result.accepted === 'duplicate') {
      res.status(200).json({
        success: true,
        duplicate: true,
        bid_id: result.bid_id,
        current_bid: result.current_bid,
        current_bidder_id: result.current_bidder_id,
      });
      return;
    }

    res.status(result.status).json({
      success: false,
      error: result.error,
      message: result.message,
    });
  } catch (err) {
    console.error('Unhandled bid error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Internal server error' });
  }
}
