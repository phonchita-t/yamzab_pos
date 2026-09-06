import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './middleware/validate.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import menuRoutes from './routes/menu.routes.js';
import customerRoutes from './routes/customers.routes.js';
import orderRoutes from './routes/orders.routes.js';
import reportRoutes from './routes/reports.routes.js';
import tierRoutes from './routes/tiers.routes.js';

const app = express();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'yam-zabb-pos-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tiers', tierRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🌶️  Yam Zabb POS API listening on http://localhost:${config.port}`);
});
