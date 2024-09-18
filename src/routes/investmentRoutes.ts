import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const sampleInvestments = [
    { id: 1, name: 'Tech Stock Fund', amount: 5000, userId: 1 },
    { id: 2, name: 'Real Estate Trust', amount: 10000, userId: 2 },
    { id: 3, name: 'Bond Portfolio', amount: 7500, userId: 3 },
  ];

  res.json(sampleInvestments);
});

export default router;