import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { supabaseAdmin } from '../services/supabase';
import { getDefaultDeadline } from '../lib/deadline';

const router = Router();

// Apply auth middleware. Unit heads can read, but only admins can write.
router.use(requireAuth);

/**
 * GET /api/deadlines/:month
 * Returns the configured deadline for a month, or the default computed deadline if none exists.
 */
router.get('/:month', async (req: AuthenticatedRequest, res: Response) => {
  const { month } = req.params; // Format: YYYY-MM-DD

  try {
    const { data: deadlineRow, error } = await supabaseAdmin
      .from('report_deadlines')
      .select('*')
      .eq('month', month)
      .maybeSingle();

    if (error) {
      console.error('Error fetching deadline:', error);
      return res.status(500).json({ error: 'Failed to retrieve deadline' });
    }

    if (deadlineRow) {
      return res.status(200).json(deadlineRow);
    } else {
      // Auto-compute default
      const defaultDate = getDefaultDeadline(month);
      return res.status(200).json({
        month,
        deadline_date: defaultDate,
        first_reminder_sent: false,
        is_default: true
      });
    }
  } catch (err) {
    console.error('Unexpected error in get deadline:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/deadlines
 * Creates or updates a custom deadline date for a reporting month. Admins only.
 */
router.post('/', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { month, deadlineDate } = req.body;

  if (!month || !deadlineDate) {
    return res.status(400).json({ error: 'month and deadlineDate are required' });
  }

  try {
    // 1. Check if a deadline row already exists and is locked
    const { data: existingDeadline } = await supabaseAdmin
      .from('report_deadlines')
      .select('*')
      .eq('month', month)
      .maybeSingle();

    if (existingDeadline && existingDeadline.first_reminder_sent) {
      return res.status(400).json({
        error: 'The deadline can no longer be changed because the first reminder has already been sent.'
      });
    }

    let resultDeadline;

    if (existingDeadline) {
      // Update in place
      const { data, error } = await supabaseAdmin
        .from('report_deadlines')
        .update({
          deadline_date: deadlineDate,
          created_by: user.id
        })
        .eq('month', month)
        .select('*')
        .single();

      if (error) {
        console.error('Failed to update custom deadline:', error);
        return res.status(500).json({ error: 'Failed to update custom deadline' });
      }
      resultDeadline = data;
    } else {
      // Insert new custom deadline
      const { data, error } = await supabaseAdmin
        .from('report_deadlines')
        .insert({
          month,
          deadline_date: deadlineDate,
          first_reminder_sent: false,
          created_by: user.id
        })
        .select('*')
        .single();

      if (error) {
        console.error('Failed to insert custom deadline:', error);
        return res.status(500).json({ error: 'Failed to save custom deadline' });
      }
      resultDeadline = data;
    }

    return res.status(200).json({
      message: 'Deadline configuration updated successfully.',
      deadline: resultDeadline
    });

  } catch (err) {
    console.error('Unexpected error configuring deadline:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
