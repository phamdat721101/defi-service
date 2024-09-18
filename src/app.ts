import express from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import routes from './routes';
// import { errorMiddleware } from './middleware/errorMiddleware';

const app = express();

// Enable CORS for all origins
app.use(cors({
  origin: '*'
}));

app.use(express.json());
app.use('/api', routes);
// app.use(errorMiddleware);

app.listen(ENV.PORT, () => {
  console.log(`Server running on port ${ENV.PORT}`);
});

export default app;