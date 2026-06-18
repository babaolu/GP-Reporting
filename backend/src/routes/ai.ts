import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { supabaseAdmin } from '../services/supabase';
import { summarizeMonthly, analyzeTrend } from '../services/anthropic';

const router = Router();

// Apply authentication and administrator authorization
router.use(requireAuth);
router.use(requireAdmin);

/**
 * POST /api/ai/summarize-monthly
 * Generates or regenerates the cross-unit summary for a given reporting month.
 */
router.post('/summarize-monthly', async (req: AuthenticatedRequest, res: Response) => {
  const { month } = req.body;

  if (!month) {
    return res.status(400).json({ error: 'Month (YYYY-MM-DD) is required' });
  }

  try {
    // 1. Fetch all reports for the month that have completed AI processing
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from('reports')
      .select('ai_summary, units(name)')
      .eq('month', month)
      .eq('is_latest', true)
      .eq('ai_status', 'done');

    if (reportsError) {
      console.error('Error fetching reports for monthly summary:', reportsError);
      return res.status(500).json({ error: 'Failed to retrieve reports data' });
    }

    if (!reports || reports.length === 0) {
      return res.status(400).json({ error: 'No reports with completed AI analysis found for this month' });
    }

    // 2. Initialize or set status to processing in monthly_summaries
    const { data: existingSummary } = await supabaseAdmin
      .from('monthly_summaries')
      .select('id')
      .eq('month', month)
      .maybeSingle();

    if (existingSummary) {
      await supabaseAdmin
        .from('monthly_summaries')
        .update({ ai_status: 'processing' })
        .eq('month', month);
    } else {
      await supabaseAdmin
        .from('monthly_summaries')
        .insert({ month, ai_status: 'processing' });
    }

    // 3. Format reports array for prompt input
    const unitSummaries = reports.map(r => {
      const unitObj: any = r.units;
      const unitName = Array.isArray(unitObj)
        ? (unitObj[0]?.name || 'Unknown')
        : (unitObj?.name || 'Unknown');

      return {
        unit_name: unitName,
        ai_summary: r.ai_summary
      };
    });

    // Format month label (e.g. '2025-06-01' -> 'June 2025')
    const parts = month.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthLabel = `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`;

    // 4. Trigger asynchronous/immediate processing
    // Since this can take a few seconds, we wait for it to return so the admin sees the generated summary,
    // but we wrap it in a try-catch to update monthly_summaries.ai_status if it fails.
    try {
      const summaryResult = await summarizeMonthly(monthLabel, unitSummaries);

      const { data: updatedSummary, error: updateError } = await supabaseAdmin
        .from('monthly_summaries')
        .update({
          overall_summary: summaryResult.overall_summary,
          common_issues: summaryResult.common_issues || [],
          common_breakthroughs: summaryResult.common_breakthroughs || [],
          critical_alerts: summaryResult.critical_alerts || [],
          cross_unit_themes: summaryResult.cross_unit_themes || [],
          unit_highlights: summaryResult.unit_highlights || [],
          generated_at: new Date().toISOString(),
          ai_status: 'done'
        })
        .eq('month', month)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      return res.status(200).json({
        message: 'Monthly cross-unit summary generated successfully',
        summary: updatedSummary
      });

    } catch (apiErr) {
      console.error('LLM API error during monthly cross-unit summary generation:', apiErr);
      await supabaseAdmin
        .from('monthly_summaries')
        .update({ ai_status: 'failed' })
        .eq('month', month);
      return res.status(500).json({ error: 'AI generation failed. Please try again.' });
    }

  } catch (err) {
    console.error('Unexpected error generating monthly summary:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/ai/trend
 * Computes trend analysis for a unit on demand (lazy loaded).
 */
router.post('/trend', async (req: AuthenticatedRequest, res: Response) => {
  const { unitId } = req.body;

  if (!unitId) {
    return res.status(400).json({ error: 'Unit ID is required' });
  }

  try {
    // 1. Fetch unit name
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('name')
      .eq('id', unitId)
      .single();

    if (unitError || !unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // 2. Fetch the last 6 months of reports (latest versions only) in chronological order
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from('reports')
      .select('month, ai_summary')
      .eq('unit_id', unitId)
      .eq('is_latest', true)
      .eq('ai_status', 'done')
      .order('month', { ascending: true })
      .limit(6);

    if (reportsError) {
      console.error('Error fetching reports for trend analysis:', reportsError);
      return res.status(500).json({ error: 'Failed to retrieve unit report history' });
    }

    if (!reports || reports.length === 0) {
      return res.status(400).json({ error: 'No report history with completed AI summaries found for this unit' });
    }

    // 3. Format summaries array with month labels (oldest first)
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const chronologicalSummaries = reports.map(r => {
      const parts = r.month.split('-');
      const monthLabel = `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
      return {
        month: monthLabel,
        ai_summary: r.ai_summary
      };
    });

    // 4. Call LLM to generate trend analysis
    console.log(`Generating trend analysis for ${unit.name} across ${reports.length} months...`);
    const trendAnalysis = await analyzeTrend(unit.name, chronologicalSummaries);

    return res.status(200).json(trendAnalysis);

  } catch (err) {
    console.error('Unexpected error generating trend analysis:', err);
    return res.status(500).json({ error: 'Failed to generate trend analysis' });
  }
});

export default router;
