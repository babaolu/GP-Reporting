import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { supabaseAdmin } from '../services/supabase';
import { sendReminderEmail } from '../services/email';
import { sendTelegramReminder } from '../services/telegram';
import { formatHumanDate, getDefaultDeadline } from '../lib/deadline';

const router = Router();

// Require admin authentication for manual notification dispatch
router.post('/send', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { unitId, sequenceNum } = req.body;

  if (!unitId || !sequenceNum) {
    return res.status(400).json({ error: 'unitId and sequenceNum (1, 2, or 3) are required' });
  }

  const seq = parseInt(sequenceNum, 10);
  if (seq < 1 || seq > 3) {
    return res.status(400).json({ error: 'sequenceNum must be 1, 2, or 3' });
  }

  try {
    // 1. Fetch unit details
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('*')
      .eq('id', unitId)
      .single();

    if (unitError || !unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    if (unit.status !== 'active') {
      return res.status(400).json({ error: 'Cannot send reminders to frozen or deactivated units.' });
    }

    // 2. Fetch unit head profile
    const { data: head, error: headError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('unit_id', unitId)
      .eq('role', 'unit_head')
      .eq('account_status', 'active')
      .maybeSingle();

    if (headError || !head) {
      return res.status(404).json({ error: 'No active Unit Head found for this unit' });
    }

    // 3. Compute or fetch current month deadline
    const watNow = new Date(Date.now() + 1 * 60 * 60 * 1000);
    const year = watNow.getUTCFullYear();
    const monthIndex = watNow.getUTCMonth();
    const currentMonthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;

    const { data: deadlineRow } = await supabaseAdmin
      .from('report_deadlines')
      .select('deadline_date')
      .eq('month', currentMonthStr)
      .maybeSingle();

    const deadlineDateStr = deadlineRow?.deadline_date || getDefaultDeadline(currentMonthStr);
    const formattedDeadlineHuman = formatHumanDate(deadlineDateStr);
    const monthLabel = `${[
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ][monthIndex]} ${year}`;

    // Map sequence number to days remaining for mock text
    const daysRemainingMap: Record<number, number> = { 1: 6, 2: 3, 3: 1 };
    const daysRemaining = daysRemainingMap[seq] || 1;

    // 4. Dispatch Email
    const emailSent = await sendReminderEmail(
      head.email,
      head.full_name || 'Unit Head',
      unit.name,
      formattedDeadlineHuman,
      daysRemaining,
      seq,
      monthLabel
    );

    // 5. Dispatch Telegram (if linked)
    let telegramSent = false;
    if (head.telegram_linked && head.telegram_chat_id) {
      telegramSent = await sendTelegramReminder(
        head.telegram_chat_id,
        head.full_name || 'Unit Head',
        unit.name,
        daysRemaining,
        formattedDeadlineHuman,
        seq
      );
    }

    // Log notification in audit trail
    await supabaseAdmin.from('notification_log').insert({
      unit_id: unitId,
      month: currentMonthStr,
      reminder_sequence: seq,
      email_sent: emailSent,
      telegram_sent: telegramSent
    });

    return res.status(200).json({
      message: `Manual notification (Sequence ${seq}/3) sent successfully.`,
      emailSent,
      telegramSent
    });

  } catch (err) {
    console.error('Unexpected error dispatching manual notification:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
