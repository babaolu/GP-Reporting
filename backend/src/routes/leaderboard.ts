import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { getLeaderboardData } from '../services/leaderboard';

const router = Router();

// Apply auth and admin middleware (leaderboard is admin-only)
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/leaderboard
 * Returns ranked leaderboard list. Accepts optional ?month=YYYY-MM-DD snapshot filter.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { month } = req.query;

  try {
    const data = await getLeaderboardData(month ? String(month) : undefined);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('Error fetching leaderboard data:', err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard data', details: err.message });
  }
});

export default router;
