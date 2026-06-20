import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getCurrentReportingMonth, formatMonthLabel } from '../../lib/date-helpers';
import { 
  CheckCircle2, 
  Clock, 
  Snowflake, 
  ArrowRight, 
  AlertCircle,
  FileText,
  Loader2
} from 'lucide-react';

interface UnitStatus {
  id: string;
  name: string;
  status: 'active' | 'frozen' | 'deactivated';
  headName: string | null;
  report: any | null;
  statusType: 'submitted' | 'late' | 'pending' | 'frozen';
}

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const currentMonthStr = getCurrentReportingMonth();

  const [unitsData, setUnitsData] = useState<UnitStatus[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<{ unitName: string; alerts: string[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOverviewData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch units (excluding deactivated)
      const { data: units } = await supabase
        .from('units')
        .select('*')
        .neq('status', 'deactivated')
        .order('name', { ascending: true });

      // 2. Fetch profiles
      const { data: heads } = await supabase
        .from('profiles')
        .select('full_name, unit_id')
        .eq('role', 'unit_head');

      // 3. Fetch current month's latest reports
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('month', currentMonthStr)
        .eq('is_latest', true);

      if (units) {
        const headMap = new Map<string, string>();
        if (heads) {
          heads.forEach(h => {
            if (h.unit_id) headMap.set(h.unit_id, h.full_name || 'Unit Head');
          } );
        }

        const reportMap = new Map<string, any>();
        if (reports) {
          reports.forEach(r => {
            reportMap.set(r.unit_id, r);
          });
        }

        const compiled: UnitStatus[] = units.map(u => {
          const report = reportMap.get(u.id) || null;
          const headName = headMap.get(u.id) || null;

          let statusType: 'submitted' | 'late' | 'pending' | 'frozen' = 'pending';
          if (u.status === 'frozen') {
            statusType = 'frozen';
          } else if (report) {
            statusType = report.is_late ? 'late' : 'submitted';
          }

          return {
            id: u.id,
            name: u.name,
            status: u.status,
            headName,
            report,
            statusType
          };
        });

        setUnitsData(compiled);

        // Extract critical alerts from AI summaries
        const alertsList: { unitName: string; alerts: string[] }[] = [];
        compiled.forEach(item => {
          if (item.report && item.report.ai_summary?.critical_alerts?.length > 0) {
            alertsList.push({
              unitName: item.name,
              alerts: item.report.ai_summary.critical_alerts
            });
          }
        });
        setCriticalAlerts(alertsList);
      }
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverviewData();
  }, [currentMonthStr]);

  // Calculations for progress bar
  const totalUnits = unitsData.filter(u => u.statusType !== 'frozen').length;
  const submittedUnits = unitsData.filter(u => u.statusType === 'submitted' || u.statusType === 'late').length;
  const submissionRate = totalUnits > 0 ? Math.round((submittedUnits / totalUnits) * 100) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-bg">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6 animate-fade-in">
      {/* Title Header */}
      <div className="bg-white p-4 lg:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold font-display text-primary-text mb-1">
            Administration Console
          </h1>
          <p className="text-xs lg:text-sm text-gray-500 font-sans">
            Overview statistics for <span className="font-semibold text-primary">{formatMonthLabel(currentMonthStr)}</span>
          </p>
        </div>
        
        <button
          onClick={() => navigate('/admin/summaries')}
          className="w-full lg:w-auto flex items-center justify-center text-xs font-bold text-white bg-primary hover:bg-indigo-800 py-3 px-5 rounded-2xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
        >
          View Executive Monthly Summary <ArrowRight className="h-4 w-4 ml-1.5" />
        </button>
      </div>

      {/* Progress Card */}
      <div className="bg-white p-4 lg:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Submission Rate</h3>
            <div className="text-lg lg:text-2xl font-bold font-display text-primary-text mt-1">
              {submittedUnits} of {totalUnits} active departments submitted
            </div>
          </div>
          <span className="text-2xl lg:text-3xl font-bold font-mono text-primary self-start sm:self-auto">{submissionRate}%</span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-indigo-50 h-3 rounded-full overflow-hidden border border-indigo-100/50">
          <div 
            className="bg-primary h-full rounded-full transition-all duration-500" 
            style={{ width: `${submissionRate}%` }}
          />
        </div>
      </div>

      {/* Critical Alerts Banner (surfaces if alerts exist) */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-4 lg:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-red-800 font-bold font-display text-base lg:text-lg">
            <AlertCircle className="h-5 w-5 text-danger-custom" />
            <h3>Urgent Alerts surfaced by AI Analysis</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {criticalAlerts.map((alertGroup, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-red-100 shadow-xxs">
                <span className="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-100 inline-block">
                  {alertGroup.unitName}
                </span>
                <ul className="list-disc pl-5 mt-3 text-xs text-primary-text space-y-1.5 font-sans">
                  {alertGroup.alerts.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of Department Cards */}
      <div className="space-y-3 lg:space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Departments & Reports Status</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
          {unitsData.map((unit) => {
            const cardConfigs = {
              submitted: {
                border: 'border-green-200',
                badgeText: 'Submitted',
                badgeClass: 'bg-green-50 text-green-700 border-green-200',
                badgeIcon: CheckCircle2
              },
              late: {
                border: 'border-amber-200',
                badgeText: 'Late',
                badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
                badgeIcon: Clock
              },
              pending: {
                border: 'border-indigo-100',
                badgeText: 'Pending',
                badgeClass: 'bg-indigo-50/50 text-indigo-700 border-indigo-100/50',
                badgeIcon: Clock
              },
              frozen: {
                border: 'border-gray-200 bg-gray-50/50',
                badgeText: 'Frozen',
                badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
                badgeIcon: Snowflake
              }
            };

            const config = cardConfigs[unit.statusType];
            const BadgeIcon = config.badgeIcon;

            return (
              <div
                key={unit.id}
                onClick={() => navigate(`/admin/units/${unit.id}`)}
                className={`bg-white p-4 rounded-3xl border ${config.border} shadow-xxs hover:shadow-sm hover:scale-98 transition-all duration-250 cursor-pointer flex flex-col justify-between min-h-[12rem]`}
              >
                <div>
                  <div className="flex flex-col min-[350px]:flex-row min-[350px]:items-start min-[350px]:justify-between gap-1.5">
                    <h4 className="text-sm sm:text-base font-bold font-display text-primary-text truncate max-w-[70%]">
                      {unit.name}
                    </h4>
                    
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center w-fit shrink-0 ${config.badgeClass}`}>
                      <BadgeIcon className="h-3 w-3 mr-0.5" /> {config.badgeText}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 font-sans mt-2">
                    Leader: <span className="font-semibold">{unit.headName || 'Not Assigned'}</span>
                  </p>
                </div>

                <div className="border-t border-gray-50 pt-3 flex flex-col min-[350px]:flex-row min-[350px]:items-center min-[350px]:justify-between gap-2 text-[10px] text-gray-400">
                  {unit.report ? (
                    <span className="flex items-center">
                      <FileText className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                      {new Date(unit.report.submitted_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span>No reports.</span>
                  )}
                  <span className="text-primary font-bold hover:underline flex items-center shrink-0">
                    Detail view <ArrowRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
export default Overview;
