import { Request, Response } from 'express';
import { createCapital } from '../services/leofiServices';

export class LeofiController {
  async createCapital(req: Request, res: Response) {
    try {
      const { data } = req.body;
      const result = await createCapital(data);
      console.log("Create capital result: ", result);
      res.json(result);
    } catch (error) {
        console.log("Error create capital: ", error)
      res.status(500).json({ error: 'Error create capital' });
    }
  }
}
