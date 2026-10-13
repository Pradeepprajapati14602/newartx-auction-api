import { r, MasterPool } from 'rethinkdb-ts';

const DB_HOST = process.env.RETHINKDB_HOST ?? 'localhost';
const DB_PORT = parseInt(process.env.RETHINKDB_PORT ?? '28015', 10);
const DB_NAME = process.env.RETHINKDB_DB ?? 'auction';

let pool: MasterPool | null = null;

export function getPool(): MasterPool {
  if (!pool) throw new Error('Database pool not initialised');
  return pool;
}

export { r, DB_NAME };

export async function connectDb(retries = 10, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      pool = await r.connectPool({
        host: DB_HOST,
        port: DB_PORT,
        db: DB_NAME,
      });
      console.log(`Connected to RethinkDB at ${DB_HOST}:${DB_PORT}`);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`RethinkDB not ready (attempt ${attempt}/${retries}), retrying in ${delayMs}ms…`);
      await sleep(delayMs);
    }
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.drain();
    pool = null;
  }
}

export async function initDb(retries = 5, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const db = r.db(DB_NAME);

      const dbs: string[] = await r.dbList().run();
      if (!dbs.includes(DB_NAME)) {
        await r.dbCreate(DB_NAME).run();
      }

      const tables: string[] = await db.tableList().run();

      if (!tables.includes('auctions')) {
        await db.tableCreate('auctions').run();
        await db.table('auctions').indexCreate('ends_at').run();
        await db.table('auctions').indexWait('ends_at').run();
      }

      if (!tables.includes('bids')) {
        await db.tableCreate('bids').run();
        await db.table('bids').indexCreate('auction_id').run();
        await db.table('bids').indexWait('auction_id').run();
        await db.table('bids').indexCreate('idempotency_key').run();
        await db.table('bids').indexWait('idempotency_key').run();
      }

      await db.table('auctions').wait().run();
      await db.table('bids').wait().run();

      await seedSampleAuction();
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

async function seedSampleAuction(): Promise<void> {
  const SAMPLE_ID = 'sample-auction-001';
  const existing = await r.db(DB_NAME).table('auctions').get(SAMPLE_ID).run();

  if (existing) return;

  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await r
    .db(DB_NAME)
    .table('auctions')
    .insert({
      id: SAMPLE_ID,
      title: 'Sample Artwork #1',
      status: 'active',
      starting_price: 100,
      current_bid: 100,
      current_bidder_id: null,
      ends_at: endsAt.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .run();

  console.log(`Seeded sample auction: ${SAMPLE_ID} (ends ${endsAt.toISOString()})`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
