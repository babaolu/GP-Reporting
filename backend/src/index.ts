import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Import services and jobs
import { seedSuperAdmin } from './services/seed';
import { runReminderJob } from './jobs/reminders';

// Import routers
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import unitsRouter from './routes/units';
import reportsRouter from './routes/reports';
import parseRouter from './routes/parse';
import aiRouter from './routes/ai';
import notificationsRouter from './routes/notifications';
import telegramRouter from './routes/telegram';
import exportRouter from './routes/export';
import leaderboardRouter from './routes/leaderboard';
import deadlinesRouter from './routes/deadlines';
import cronRouter from './routes/cron';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS and parsing middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/units', unitsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/parse', parseRouter);
app.use('/api/ai', aiRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/export', exportRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/deadlines', deadlinesRouter);
app.use('/api/cron', cronRouter);

// Basic health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Grace Place Church Report Management API is active' });
});

// Start scheduled jobs (Daily at 08:00 West Africa Time / Lagos timezone)
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] Starting daily report reminder check...');
  const result = await runReminderJob();
  console.log('[CRON] Daily report reminder check finished:', result.status);
}, {
  scheduled: true,
  timezone: 'Africa/Lagos'
});

// Start server
app.listen(port, async () => {
  console.log(`[SERVER] Express API running on port ${port}`);
  
  // Seed the initial Super Admin profile if empty
  await seedSuperAdmin();
});

export default app;
