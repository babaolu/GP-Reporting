import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getPastMonthsList, getCurrentReportingMonth } from '../../lib/date-helpers';
import useDeadline from '../../hooks/useDeadline';
import MonthNode from './MonthNode';
import ReportSlideOver from './ReportSlideOver';
import { Loader2 } from 'lucide-react';

interface ReportTimelineProps {
  unitId: string;
}

export const ReportTimeline: React.FC<ReportTimelineProps> = ({ unitId }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [unitName, setUnitName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const months = getPastMonthsList(6);
  const currentMonthStr = getCurrentReportingMonth();
  const { daysRemaining } = useDeadline(currentMonthStr);

  const loadTimelineData = async () => {
    if (!unitId) return;
    setIsLoading(true);
    try {
      // 1. Fetch unit name
      const { data: unitData } = await supabase
        .from('units')
        .select('name')
        .eq('id', unitId)
        .single();
      if (unitData) {
        setUnitName(unitData.name);
      }

      // 2. Fetch reports
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('unit_id', unitId)
        .eq('is_latest', true)
        .in('month', months);

      if (!error && data) {
        setReports(data);
      }
    } catch (err) {
      console.error('Failed to load timeline reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTimelineData();
  }, [unitId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="text-xs text-gray-500 mt-2">Loading report history timeline...</span>
      </div>
    );
  }

  // Determine status for a calendar month
  const getMonthStatusAndReport = (m: string) => {
    const reportObj = reports.find(r => r.month === m);
    if (reportObj) {
      return {
        status: (reportObj.is_late ? 'late' : 'on_time') as 'on_time' | 'late',
        report: reportObj
      };
    }

    // No report exists. Check timeline context.
    if (m === currentMonthStr) {
      // Current month - check if deadline passed
      const isLate = daysRemaining === 0;
      return {
        status: (isLate ? 'missing' : 'future') as 'missing' | 'future',
        report: null
      };
    }

    // Past month
    if (m < currentMonthStr) {
      return {
        status: 'missing' as 'missing',
        report: null
      };
    }

    // Future month
    return {
      status: 'future' as 'future',
      report: null
    };
  };

  return (
    <div className="relative space-y-6">
      {/* Timeline spine connecting vertical nodes (aligned to left-4 on mobile, left-10 on desktop) */}
      <div className="absolute left-4 lg:left-10 top-6 bottom-6 w-0.5 bg-gray-200"></div>

      <div className="space-y-6 relative">
        {months.map((m) => {
          const { status, report } = getMonthStatusAndReport(m);
          return (
            <div key={m} className="relative">
              <MonthNode
                month={m}
                status={status}
                submittedAt={report?.submitted_at}
                version={report?.version}
                unitName={unitName}
                aiSummaryPreview={report?.ai_summary?.summary}
                onClick={() => report && setActiveReportId(report.id)}
              />
            </div>
          );
        })}
      </div>

      {/* Slide Over Details Panel */}
      {activeReportId && (
        <ReportSlideOver
          reportId={activeReportId}
          onClose={() => {
            setActiveReportId(null);
            loadTimelineData(); // Reload timeline states in case comment logs updated
          }}
        />
      )}
    </div>
  );
};
export default ReportTimeline;
