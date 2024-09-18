import { Request, Response } from 'express';
import { uploadDataToWalrus, getDataFromWalrus } from '../services/walrusServices';

export class WalrusController {
  async uploadData(req: Request, res: Response) {
    try {
      const { data } = req.body;
      const result = await uploadDataToWalrus(data);
      console.log("Walrus result: ", result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error uploading data to Walrus' });
    }
  }

  async getData(req: Request, res: Response) {
    try {
      const blodId = req.query.blodId as string;
      console.log("ID: ", blodId);
      const result = await getDataFromWalrus(blodId);
      res.json(result);
    } catch (error) {
      console.log("Error get data: ", error);
      res.status(500).json({ error: 'Error retrieving data from Walrus' });
    }
  }
}
