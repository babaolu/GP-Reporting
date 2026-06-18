import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { supabaseAdmin } from '../services/supabase';
import { getDefaultDeadline } from '../lib/deadline';
import { summarizeReport } from '../services/anthropic';

const router = Router();

// Apply authentication middleware to all report endpoints
router.use(requireAuth);

/**
 * Triggers AI summarization asynchronously in the background.
 */
async function runAISummarizationInBackground(reportId: string, unitId: string, monthStr: string, parsedText: string) {
  try {
    // 1. Update status to processing
    await supabaseAdmin
      .from('reports')
      .update({ ai_status: 'processing' })
      .eq('id', reportId);

    // 2. Fetch unit details to get unit name
    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('name')
      .eq('id', unitId)
      .single();

    const unitName = unit?.name || 'Church Department';

    // Format month label (e.g. '2025-06-01' -> 'June 2025')
    const parts = monthStr.split('-');
    const year = parts[0];
    const monthNum = parseInt(parts[1], 10);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthLabel = `${monthNames[monthNum - 1]} ${year}`;

    // 3. Call LLM Summarizer
    const aiSummary = await summarizeReport(unitName, monthLabel, parsedText);

    // 4. Update the database on success
    await supabaseAdmin
      .from('reports')
      .update({
        ai_status: 'done',
        ai_summary: aiSummary
      })
      .eq('id', reportId);

    console.log(`AI Summarization successfully completed for report: ${reportId}`);
  } catch (err) {
    console.error(`AI Summarization failed for report: ${reportId}`, err);
    // Set status to failed
    await supabaseAdmin
      .from('reports')
      .update({ ai_status: 'failed' })
      .eq('id', reportId);
  }
}

/**
 * Common handler for report submission and resubmission.
 */
async function handleSubmission(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { month, contentText, fileUrl, fileType, parsedText } = req.body;

  if (!month) {
    return res.status(400).json({ error: 'Reporting month is required' });
  }

  // Ensure user has a unit assigned (admins cannot submit reports)
  if (user.role !== 'unit_head' || !user.unit_id) {
    return res.status(403).json({ error: 'Only Unit Heads can submit unit reports' });
  }

  // Mutual exclusivity validation
  if (contentText && fileUrl) {
    return res.status(400).json({ error: 'You cannot submit text content and a file upload simultaneously. Please clear one.' });
  }

  if (!contentText && !fileUrl) {
    return res.status(400).json({ error: 'Please enter report text or upload a report file.' });
  }

  const finalParsedText = parsedText || contentText || '';

  try {
    // 1. Fetch unit details to check status
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('status')
      .eq('id', user.unit_id)
      .single();

    if (unitError || !unit) {
      return res.status(404).json({ error: 'Associated unit not found' });
    }

    if (unit.status !== 'active') {
      return res.status(400).json({ error: 'This unit is frozen or deactivated. Report submission is not allowed.' });
    }

    // 2. Fetch or compute the monthly report deadline
    const { data: deadlineRow } = await supabaseAdmin
      .from('report_deadlines')
      .select('deadline_date')
      .eq('month', month)
      .maybeSingle();

    const deadlineDateStr = deadlineRow?.deadline_date || getDefaultDeadline(month);

    // Compute if submission is late in West Africa Time (UTC+1)
    const now = new Date();
    const watTime = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const currentDateStr = watTime.toISOString().split('T')[0];
    const isLate = currentDateStr > deadlineDateStr;

    // 3. Check for existing report for this unit and month
    const { data: existingReport } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('unit_id', user.unit_id)
      .eq('month', month)
      .eq('is_latest', true)
      .maybeSingle();

    if (!existingReport) {
      // --- FIRST-TIME SUBMISSION ---
      const { data: newReport, error: insertError } = await supabaseAdmin
        .from('reports')
        .insert({
          unit_id: user.unit_id,
          submitted_by: user.id,
          month,
          content_text: contentText || null,
          file_url: fileUrl || null,
          file_type: fileType || null,
          is_late: isLate,
          version: 1,
          is_latest: true,
          parsed_text: finalParsedText,
          ai_status: 'pending'
        })
        .select('*')
        .single();

      if (insertError || !newReport) {
        console.error('Failed to save report:', insertError);
        return res.status(500).json({ error: 'Failed to save report submission' });
      }

      // Trigger AI Summarization in the background
      runAISummarizationInBackground(newReport.id, user.unit_id, month, finalParsedText);

      return res.status(201).json({
        message: isLate ? 'Late report submitted successfully.' : 'Report submitted successfully.',
        report: newReport
      });

    } else {
      // --- RESUBMISSION SCENARIOS ---
      
      if (!isLate) {
        // --- BEFORE-DEADLINE: SILENT REPLACE ---
        const { data: updatedReport, error: updateError } = await supabaseAdmin
          .from('reports')
          .update({
            content_text: contentText || null,
            file_url: fileUrl || null,
            file_type: fileType || null,
            parsed_text: finalParsedText,
            ai_status: 'pending',
            ai_summary: null,
            submitted_at: new Date().toISOString()
          })
          .eq('id', existingReport.id)
          .select('*')
          .single();

        if (updateError || !updatedReport) {
          console.error('Failed to update report in-place:', updateError);
          return res.status(500).json({ error: 'Failed to update report' });
        }

        // Trigger AI Summarization in the background
        runAISummarizationInBackground(updatedReport.id, user.unit_id, month, finalParsedText);

        return res.status(200).json({
          message: 'Your report has been updated.',
          report: updatedReport
        });

      } else {
        // --- AFTER-DEADLINE: ARCHIVED + FLAGGED ---
        
        // Step A: Mark existing latest report as archived
        const { error: archiveError } = await supabaseAdmin
          .from('reports')
          .update({ is_latest: false })
          .eq('id', existingReport.id);

        if (archiveError) {
          console.error('Failed to archive previous report version:', archiveError);
          return res.status(500).json({ error: 'Failed to archive previous report version' });
        }

        // Step B: Insert a new version row
        const newVersion = existingReport.version + 1;
        const { data: newReport, error: insertError } = await supabaseAdmin
          .from('reports')
          .insert({
            unit_id: user.unit_id,
            submitted_by: user.id,
            month,
            content_text: contentText || null,
            file_url: fileUrl || null,
            file_type: fileType || null,
            is_late: true, // Always late if resubmitting after deadline
            version: newVersion,
            is_latest: true,
            parsed_text: finalParsedText,
            ai_status: 'pending'
          })
          .select('*')
          .single();

        if (insertError || !newReport) {
          console.error('Failed to create new report version:', insertError);
          // Rollback archived status of previous row to keep state clean
          await supabaseAdmin.from('reports').update({ is_latest: true }).eq('id', existingReport.id);
          return res.status(500).json({ error: 'Failed to submit revision' });
        }

        // Trigger AI Summarization in the background
        runAISummarizationInBackground(newReport.id, user.unit_id, month, finalParsedText);

        return res.status(201).json({
          message: 'Late revision submitted successfully.',
          report: newReport
        });
      }
    }
  } catch (err) {
    console.error('Unexpected error in report submission:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * POST /api/reports/submit
 * Handles initial submission or silent replacement.
 */
router.post('/submit', handleSubmission);

/**
 * POST /api/reports/resubmit
 * Aligned route for resubmitting reports.
 */
router.post('/resubmit', handleSubmission);

/**
 * POST /api/reports/:id/retry-summary
 * Triggers regeneration of AI summary for a failed report.
 */
router.post('/:id/retry-summary', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const reportId = req.params.id;

  try {
    const { data: report, error: getError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (getError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Authorization check: User must be admin OR the unit head of the unit
    if (user.role !== 'admin' && user.unit_id !== report.unit_id) {
      return res.status(403).json({ error: 'Forbidden: You cannot retry AI summary for this report' });
    }

    if (report.ai_status !== 'failed' && report.ai_status !== 'pending') {
      return res.status(400).json({ error: `AI summarization is in status "${report.ai_status}" and cannot be retried.` });
    }

    // Trigger in background and return immediate status
    runAISummarizationInBackground(report.id, report.unit_id, report.month, report.parsed_text || '');

    return res.status(200).json({ message: 'AI summarization retried.' });
  } catch (err) {
    console.error('Unexpected error in retry summary:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/reports/:id/comments
 * Adds admin feedback comment to a report.
 */
router.post('/:id/comments', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const reportId = req.params.id;
  const { comment } = req.body;

  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'Comment body is required' });
  }

  try {
    const { data: newComment, error } = await supabaseAdmin
      .from('report_comments')
      .insert({
        report_id: reportId,
        author_id: user.id,
        comment: comment.trim()
      })
      .select('*, profiles(full_name, avatar_url)')
      .single();

    if (error) {
      console.error('Failed to create comment:', error);
      return res.status(500).json({ error: 'Failed to submit comment' });
    }

    return res.status(201).json(newComment);
  } catch (err) {
    console.error('Unexpected error inserting comment:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/reports/:id/comments
 * Returns comments thread for a report.
 */
router.get('/:id/comments', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const reportId = req.params.id;

  try {
    const { data: report, error: getError } = await supabaseAdmin
      .from('reports')
      .select('unit_id')
      .eq('id', reportId)
      .single();

    if (getError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Verify user owns report or is admin
    if (user.role !== 'admin' && user.unit_id !== report.unit_id) {
      return res.status(403).json({ error: 'Forbidden: You cannot view comments for this report' });
    }

    const { data: comments, error } = await supabaseAdmin
      .from('report_comments')
      .select('*, profiles(full_name, avatar_url)')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load comments:', error);
      return res.status(500).json({ error: 'Failed to retrieve comments' });
    }

    return res.status(200).json(comments);
  } catch (err) {
    console.error('Unexpected error loading comments:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
