import { supabaseAdmin } from './supabase';
import { getDefaultDeadline } from '../lib/deadline';

export interface LeaderboardEntry {
  rank: number;
  unitId: string;
  unitName: string;
  headName: string | null;
  consistencyScore: number; // final_score
  onTimeSubmissions: number;
  totalActiveMonths: number;
  averageLeadTimeMs: number; // in milliseconds
  averageCompleteness: number; // average completeness score (1-5)
  leadTimeHours: number; // human-readable lead time
}

/**
 * Calculates the leaderboard ranking for a given month snapshot.
 * @param monthStr Month string formatted as 'YYYY-MM-01' (defaults to current month)
 */
export async function getLeaderboardData(monthStr?: string): Promise<LeaderboardEntry[]> {
  // 1. Get query month
  let targetMonth = monthStr;
  if (!targetMonth) {
    const watNow = new Date(Date.now() + 1 * 60 * 60 * 1000);
    targetMonth = `${watNow.getUTCFullYear()}-${String(watNow.getUTCMonth() + 1).padStart(2, '0')}-01`;
  }

  // 2. Fetch all units (excluding deactivated units)
  const { data: units, error: unitsError } = await supabaseAdmin
    .from('units')
    .select('*')
    .neq('status', 'deactivated');

  if (unitsError || !units) {
    console.error('Error fetching units for leaderboard:', unitsError);
    throw new Error('Failed to retrieve units');
  }

  // 3. Fetch all profiles to map unit heads
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('full_name, unit_id')
    .eq('role', 'unit_head');

  const unitHeadMap = new Map<string, string>();
  if (profiles) {
    profiles.forEach(p => {
      if (p.unit_id) {
        unitHeadMap.set(p.unit_id, p.full_name || 'Unit Head');
      }
    });
  }

  // 4. Fetch all reports up to targetMonth
  const { data: reports, error: reportsError } = await supabaseAdmin
    .from('reports')
    .select('unit_id, month, is_late, ai_summary, submitted_at')
    .lte('month', targetMonth)
    .eq('is_latest', true);

  if (reportsError) {
    console.error('Error fetching reports for leaderboard:', reportsError);
    throw new Error('Failed to retrieve reports');
  }

  // Group reports by unit
  const reportsByUnit = new Map<string, any[]>();
  if (reports) {
    reports.forEach(r => {
      const list = reportsByUnit.get(r.unit_id) || [];
      list.push(r);
      reportsByUnit.set(r.unit_id, list);
    });
  }

  // 5. Fetch all deadlines up to targetMonth (needed to calculate lead time)
  const { data: deadlines } = await supabaseAdmin
    .from('report_deadlines')
    .select('month, deadline_date')
    .lte('month', targetMonth);

  const deadlineMap = new Map<string, string>();
  if (deadlines) {
    deadlines.forEach(d => {
      deadlineMap.set(d.month, d.deadline_date);
    });
  }

  const entries: LeaderboardEntry[] = [];

  for (const unit of units) {
    const unitReports = reportsByUnit.get(unit.id) || [];
    const headName = unitHeadMap.get(unit.id) || null;

    // A. Determine active starting month
    // Either earliest report month or unit's created_at month
    let startMonth = targetMonth;
    if (unitReports.length > 0) {
      // Find oldest report month
      unitReports.forEach(r => {
        if (r.month < startMonth) {
          startMonth = r.month;
        }
      });
    } else {
      // Fallback to unit created_at
      const createdDate = new Date(unit.created_at);
      startMonth = `${createdDate.getUTCFullYear()}-${String(createdDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
    }

    // Calculate total active months (capped at query month context)
    let totalActiveMonths = 0;
    if (unit.status === 'active' || unitReports.length > 0) {
      const start = new Date(startMonth);
      const end = new Date(targetMonth);
      totalActiveMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
    }

    if (totalActiveMonths < 0) totalActiveMonths = 0;

    // B. Calculate stats from reports
    let monthsSubmittedOnTime = 0;
    let sumCompleteness = 0;
    let countCompleteness = 0;
    let sumLeadTimeMs = 0;
    let countLeadTime = 0;

    unitReports.forEach(r => {
      // Check on time
      if (!r.is_late) {
        monthsSubmittedOnTime += 1;
      }

      // Check completeness score from AI summary
      const score = r.ai_summary?.completeness_score;
      if (typeof score === 'number') {
        sumCompleteness += score;
        countCompleteness += 1;
      }

      // Calculate lead time relative to deadline
      const deadlineStr = deadlineMap.get(r.month) || getDefaultDeadline(r.month);
      // We set deadline time to the end of the day (23:59:59.999 UTC)
      const deadlineDate = new Date(`${deadlineStr}T23:59:59.999Z`);
      const submittedDate = new Date(r.submitted_at);
      
      const leadTimeMs = deadlineDate.getTime() - submittedDate.getTime();
      sumLeadTimeMs += leadTimeMs;
      countLeadTime += 1;
    });

    const averageCompleteness = countCompleteness > 0 ? (sumCompleteness / countCompleteness) : 0;
    const averageLeadTimeMs = countLeadTime > 0 ? (sumLeadTimeMs / countLeadTime) : 0;

    // C. Consistency Score Formula
    const baseScore = totalActiveMonths > 0 ? (monthsSubmittedOnTime / totalActiveMonths) * 100 : 0;
    const completenessBonus = (averageCompleteness / 5) * 10; // Out of 10 points
    const finalScore = Math.min(110, baseScore + completenessBonus); // Max score 110 (100% on-time + 10 points bonus)

    entries.push({
      rank: 0, // Assigned after sorting
      unitId: unit.id,
      unitName: unit.name,
      headName,
      consistencyScore: Math.round(finalScore * 10) / 10, // Round to 1 decimal place
      onTimeSubmissions: monthsSubmittedOnTime,
      totalActiveMonths,
      averageLeadTimeMs,
      averageCompleteness: Math.round(averageCompleteness * 10) / 10,
      leadTimeHours: Math.round((averageLeadTimeMs / (1000 * 60 * 60)) * 10) / 10 // Convert to hours
    });
  }

  // 6. Sort by:
  // - final score (descending)
  // - average lead time (descending) - tiebreaker
  entries.sort((a, b) => {
    if (b.consistencyScore !== a.consistencyScore) {
      return b.consistencyScore - a.consistencyScore;
    }
    return b.averageLeadTimeMs - a.averageLeadTimeMs;
  });

  // Assign ranks
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return entries;
}
