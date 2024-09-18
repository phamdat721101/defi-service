import { Router } from 'express';
import { WalrusController } from '../controllers/walrusController';

const router = Router();
const walrusController = new WalrusController();

router.post('/upload', walrusController.uploadData);

router.get('/data', walrusController.getData);

export default router;
