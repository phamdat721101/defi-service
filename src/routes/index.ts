import { Router } from 'express';
import profileRoutes from './profileRoutes';
import investmentRoutes from './investmentRoutes';
import walrusRoutes from './walrusRoutes';

const router = Router();

router.use('/profiles', profileRoutes);
router.use('/investments', investmentRoutes);
router.use('/walrus', walrusRoutes);
router.use('/', (req, res) => res.status(200).json({ message: 'API is working' }));

export default router;