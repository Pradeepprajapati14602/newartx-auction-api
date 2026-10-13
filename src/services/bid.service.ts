import { r, DB_NAME } from '../db/rethinkdb';
import { BidRequest } from '../validators/bid.schema';

export type BidResult =
  | { accepted: true; bid_id: string; current_bid: number; current_bidder_id: string }
  | { accepted: false; error: string; message: string; status: number }
  | { accepted: 'duplicate'; bid_id: string; current_bid: number; current_bidder_id: string };

interface Auction {
  id: string;
  title?: string;
  status: string;
  starting_price: number;
  current_bid: number;
  current_bidder_id: string | null;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

interface Bid {
  id: string;
  auction_id: string;
  user_id: string;
  amount: number;
  created_at: string;
  idempotency_key?: string;
}

export async function processBid(req: BidRequest): Promise<BidResult> {
  const { auction_id, user_id, amount, idempotency_key } = req;

  if (idempotency_key) {
    const existing = await checkIdempotency(idempotency_key, auction_id, user_id, amount);
    if (existing) return existing;
  }

  const updateResult: any = await r
    .db(DB_NAME)
    .table('auctions')
    .get(auction_id)
    .update(
      (auction: any) =>
        r.branch(
          auction.eq(null),
          r.error('AUCTION_NOT_FOUND'),

          auction('status').ne('active'),
          r.error('AUCTION_CLOSED'),

          r.now().ge(r.ISO8601(auction('ends_at'))),
          r.error('AUCTION_ENDED'),

          r.expr(amount).le(auction('current_bid')),
          r.error('BID_TOO_LOW'),

          {
            current_bid: amount,
            current_bidder_id: user_id,
            updated_at: r.now().toISO8601(),
          }
        ),
      { returnChanges: true, nonAtomic: false }
    )
    .run();

  if (updateResult.errors > 0) {
    const msg: string = updateResult.first_error ?? '';
    if (idempotency_key && msg.includes('BID_TOO_LOW')) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await checkIdempotency(idempotency_key, auction_id, user_id, amount);
        if (existing) return existing;
        await sleep(30);
      }
    }
    return mapReqlError(msg);
  }

  if (updateResult.replaced === 0 && updateResult.unchanged === 0) {
    return { accepted: false, error: 'auction_not_found', message: 'Auction not found', status: 404 };
  }

  if (updateResult.replaced === 0) {
    return { accepted: false, error: 'bid_rejected', message: 'Bid was not accepted', status: 422 };
  }

  const oldState = updateResult.changes?.[0]?.old_val as Auction | undefined;
  const newState = updateResult.changes?.[0]?.new_val as Auction;

  const bidDoc: Omit<Bid, 'id'> = {
    auction_id,
    user_id,
    amount,
    created_at: new Date().toISOString(),
    ...(idempotency_key ? { idempotency_key } : {}),
  };

  let bidId: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const insertResult: any = await r
        .db(DB_NAME)
        .table('bids')
        .insert(bidDoc, { returnChanges: true })
        .run();
      bidId = insertResult.generated_keys[0];
      break;
    } catch {
      if (attempt < 3) {
        await sleep(50 * attempt);
      }
    }
  }

  if (!bidId) {
    if (oldState) {
      try {
        await r
          .db(DB_NAME)
          .table('auctions')
          .get(auction_id)
          .update(
            (auction: any) =>
              r.branch(
                auction('current_bid').eq(amount).and(auction('current_bidder_id').eq(user_id)),
                {
                  current_bid: oldState.current_bid,
                  current_bidder_id: oldState.current_bidder_id,
                  updated_at: r.now().toISO8601(),
                },
                auction
              )
          )
          .run();
      } catch (rollbackErr) {
        console.error('Compensating rollback failed:', rollbackErr);
      }
    }

    return {
      accepted: false,
      error: 'internal_error',
      message: 'Failed to record bid history; auction state restored',
      status: 500,
    };
  }

  return {
    accepted: true,
    bid_id: bidId,
    current_bid: newState.current_bid,
    current_bidder_id: newState.current_bidder_id!,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkIdempotency(
  key: string,
  auction_id: string,
  user_id: string,
  amount: number
): Promise<BidResult | null> {
  const rows: Bid[] = await r
    .db(DB_NAME)
    .table('bids')
    .getAll(key, { index: 'idempotency_key' })
    .run();

  if (rows.length === 0) return null;

  const prev = rows[0];

  if (prev.auction_id !== auction_id || prev.user_id !== user_id || prev.amount !== amount) {
    return {
      accepted: false,
      error: 'idempotency_conflict',
      message: 'The idempotency_key was already used with a different payload',
      status: 409,
    };
  }

  const auction: Auction | null = await r.db(DB_NAME).table('auctions').get(auction_id).run();
  return {
    accepted: 'duplicate',
    bid_id: prev.id,
    current_bid: auction?.current_bid ?? prev.amount,
    current_bidder_id: auction?.current_bidder_id ?? prev.user_id,
  };
}

function mapReqlError(msg: string): BidResult {
  if (msg.includes('AUCTION_NOT_FOUND')) {
    return { accepted: false, error: 'auction_not_found', message: 'Auction not found', status: 404 };
  }
  if (msg.includes('AUCTION_CLOSED')) {
    return { accepted: false, error: 'auction_closed', message: 'Auction is closed', status: 409 };
  }
  if (msg.includes('AUCTION_ENDED')) {
    return { accepted: false, error: 'auction_ended', message: 'Auction has ended', status: 409 };
  }
  if (msg.includes('BID_TOO_LOW')) {
    return {
      accepted: false,
      error: 'bid_too_low',
      message: 'Bid amount must be strictly greater than the current highest bid',
      status: 422,
    };
  }
  return {
    accepted: false,
    error: 'bid_rejected',
    message: 'Bid could not be processed due to invalid auction state',
    status: 422,
  };
}
