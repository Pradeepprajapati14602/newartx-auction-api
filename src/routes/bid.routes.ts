import { Router } from 'express';
import { placeBid } from '../controllers/bid.controller';

export const bidRouter = Router();

bidRouter.post('/bid', placeBid);
