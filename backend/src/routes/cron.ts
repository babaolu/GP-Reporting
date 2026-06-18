import { Router, Request, Response } from 'express';
import { runReminderJob } from '../jobs/reminders';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const cronSecret = process.env.CRON_SECRET || 'super_secret_cron_job_token_12345';

/**
 * GET /api/cron/reminders
 * Executes the daily reminder checker pipeline. Secured by cron secret header.
 */
router.get('/reminders', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing cron bearer token' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== cronSecret) {
      return res.status(403).json({ error: 'Forbidden: Invalid cron secret token' });
    }

    // Trigger reminder job
    const result = await runReminderJob();
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error running reminders cron endpoint:', err);
    return res.status(500).json({ error: 'Failed to run cron job', details: err.message });
  }
});

export default router;
