import { Router, Request, Response } from 'express';
import { LeofiController } from '../controllers/leofiController';


const router = Router();
const leofiController = new LeofiController();


router.post('/', leofiController.createCapital);

export default router;