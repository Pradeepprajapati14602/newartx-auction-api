import 'dotenv/config';
import { app } from './app';
import { connectDb, initDb } from './db/rethinkdb';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function main() {
  await connectDb();
  await initDb();

  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});
