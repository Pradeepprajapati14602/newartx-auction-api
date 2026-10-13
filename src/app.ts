import express from 'express';
import { bidRouter } from './routes/bid.routes';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(bidRouter);

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    res.status(400).json({ error: 'bad_request', message: 'Malformed JSON payload' });
    return;
  }
  next(err);
});

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found' });
});

export { app };
