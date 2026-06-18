import { supabaseAdmin } from '../services/supabase';
import { getDefaultDeadline, getReminderDates, formatHumanDate } from '../lib/deadline';
import { sendReminderEmail } from '../services/email';
import { sendTelegramReminder } from '../services/telegram';

/**
 * Runs the daily reminder job.
 * Checks deadlines, determines if a reminder (1st, 2nd, 3rd) should fire today,
 * and sends out email/Telegram notifications to unit heads who haven't submitted yet.
 */
export async function runReminderJob(): Promise<{ status: string; messages: string[] }> {
  const messages: string[] = [];
  try {
    // 1. Get the current calendar month in YYYY-MM-01 format (WAT/UTC+1 context)
    const watNow = new Date(Date.now() + 1 * 60 * 60 * 1000);
    const year = watNow.getUTCFullYear();
    const monthIndex = watNow.getUTCMonth(); // 0-11
    const currentMonthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const todayStr = watNow.toISOString().split('T')[0];

    messages.push(`Running reminder job for today: ${todayStr} (Reporting month: ${currentMonthStr})`);

    // 2. Ensure a report_deadlines row exists for the current reporting month
    let { data: deadlineRow, error: deadlineError } = await supabaseAdmin
      .from('report_deadlines')
      .select('*')
      .eq('month', currentMonthStr)
      .maybeSingle();

    if (deadlineError) {
      console.error('Error fetching current month deadline:', deadlineError);
      throw new Error(`Failed to query deadline for ${currentMonthStr}`);
    }

    if (!deadlineRow) {
      const defaultDeadlineDate = getDefaultDeadline(currentMonthStr);
      messages.push(`Deadline row missing for ${currentMonthStr}. Creating with default Saturday date: ${defaultDeadlineDate}`);

      const { data: insertedDeadline, error: insertError } = await supabaseAdmin
        .from('report_deadlines')
        .insert({
          month: currentMonthStr,
          deadline_date: defaultDeadlineDate,
          first_reminder_sent: false
        })
        .select('*')
        .single();

      if (insertError || !insertedDeadline) {
        console.error('Failed to auto-create monthly deadline:', insertError);
        throw new Error('Failed to insert default monthly deadline row');
      }

      deadlineRow = insertedDeadline;
    }

    const { deadline_date: deadlineDateStr, first_reminder_sent } = deadlineRow;
    const formattedDeadlineHuman = formatHumanDate(deadlineDateStr);

    // 3. Compute reminder dates
    const { r1, r2, r3 } = getReminderDates(deadlineDateStr);
    let reminderSeq: number | null = null;
    let daysRemaining = 0;

    if (todayStr === r1) {
      reminderSeq = 1;
      daysRemaining = 6;
    } else if (todayStr === r2) {
      reminderSeq = 2;
      daysRemaining = 3;
    } else if (todayStr === r3) {
      reminderSeq = 3;
      daysRemaining = 1;
    }

    if (reminderSeq === null) {
      messages.push(`No reminder scheduled to run today. (Deadlines offsets: r1=${r1}, r2=${r2}, r3=${r3})`);
      return { status: 'skipped', messages };
    }

    messages.push(`Fired: Reminder Sequence ${reminderSeq}/3 (${daysRemaining} day(s) remaining until ${deadlineDateStr})`);

    // 4. Fetch all active units
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('id, name')
      .eq('status', 'active');

    if (unitsError || !units) {
      console.error('Failed to fetch active units:', unitsError);
      throw new Error('Could not retrieve active units');
    }

    messages.push(`Found ${units.length} active unit(s) to check.`);

    // Format month year for email subjects (e.g. 'June 2026')
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthLabel = `${monthNames[monthIndex]} ${year}`;

    // 5. Query profiles to map unit heads
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, unit_id, telegram_chat_id, telegram_linked')
      .eq('role', 'unit_head')
      .eq('account_status', 'active');

    if (profilesError || !profiles) {
      console.error('Failed to fetch unit head profiles:', profilesError);
      throw new Error('Could not retrieve unit head profiles');
    }

    // Process units one by one
    for (const unit of units) {
      // Find assigned unit head profile
      const head = profiles.find(p => p.unit_id === unit.id);
      if (!head) {
        messages.push(`Unit "${unit.name}" has no active unit head assigned. Skipping.`);
        continue;
      }

      // Check if report has already been submitted for this unit and month
      const { data: reports, error: reportsError } = await supabaseAdmin
        .from('reports')
        .select('id')
        .eq('unit_id', unit.id)
        .eq('month', currentMonthStr)
        .limit(1);

      if (reportsError) {
        console.error(`Error checking reports for unit ${unit.name}:`, reportsError);
        continue;
      }

      if (reports && reports.length > 0) {
        messages.push(`Unit "${unit.name}" has already submitted their report. Skipping notification.`);
        continue;
      }

      // Check if reminder was already logged to prevent double-sends
      const { data: existingLog } = await supabaseAdmin
        .from('notification_log')
        .select('id')
        .eq('unit_id', unit.id)
        .eq('month', currentMonthStr)
        .eq('reminder_sequence', reminderSeq)
        .maybeSingle();

      if (existingLog) {
        messages.push(`Reminder sequence ${reminderSeq} already dispatched for "${unit.name}". Skipping duplicates.`);
        continue;
      }

      messages.push(`Dispatching reminders to "${unit.name}" head (${head.email})...`);

      // Dispatch Email
      const emailSent = await sendReminderEmail(
        head.email,
        head.full_name || 'Unit Head',
        unit.name,
        formattedDeadlineHuman,
        daysRemaining,
        reminderSeq,
        monthLabel
      );

      // Dispatch Telegram (if linked)
      let telegramSent = false;
      if (head.telegram_linked && head.telegram_chat_id) {
        telegramSent = await sendTelegramReminder(
          head.telegram_chat_id,
          head.full_name || 'Unit Head',
          unit.name,
          daysRemaining,
          formattedDeadlineHuman,
          reminderSeq
        );
      }

      // Log notification in audit trail
      await supabaseAdmin.from('notification_log').insert({
        unit_id: unit.id,
        month: currentMonthStr,
        reminder_sequence: reminderSeq,
        email_sent: emailSent,
        telegram_sent: telegramSent
      });

      messages.push(`Logged notification: Email=${emailSent}, Telegram=${telegramSent}`);
    }

    // 6. If this was the first reminder, lock the deadline
    if (reminderSeq === 1 && !first_reminder_sent) {
      messages.push(`Locking deadline configuration for month ${currentMonthStr}.`);
      await supabaseAdmin
        .from('report_deadlines')
        .update({ first_reminder_sent: true })
        .eq('month', currentMonthStr);
    }

    return { status: 'completed', messages };

  } catch (err: any) {
    console.error('Error running daily reminders cron job:', err);
    return { status: 'error', messages: [...messages, `Error: ${err.message}`] };
  }
}
