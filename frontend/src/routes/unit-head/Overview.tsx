import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { getCurrentReportingMonth, formatMonthLabel } from '../../lib/date-helpers';
import useDeadline from '../../hooks/useDeadline';
import { FileInput, Info, CheckCircle2, AlertTriangle, Clock, ArrowRight, BellRing, User } from 'lucide-react';

export const Overview: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const currentMonthStr = getCurrentReportingMonth();
  const { daysRemaining, deadline, isLoading: deadlineLoading } = useDeadline(currentMonthStr);
  
  const [report, setReport] = useState<any | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [greeting, setGreeting] = useState('Welcome');

  const checkReportStatus = async () => {
    if (!user?.unit_id) return;
    setIsLoadingReport(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('unit_id', user.unit_id)
        .eq('month', currentMonthStr)
        .eq('is_latest', true)
        .maybeSingle();

      if (!error && data) {
        setReport(data);
      } else {
        setReport(null);
      }
    } catch (err) {
      console.error('Error fetching current month report status:', err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  useEffect(() => {
    checkReportStatus();

    // Determine greeting based on local time
    const hr = new Date().getHours();
    if (hr < 12) setGreeting('Good morning');
    else if (hr < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, [user, currentMonthStr]);

  const hasSubmitted = !!report;
  const isOverdue = !hasSubmitted && daysRemaining === 0;

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in">
      {/* Welcome & Title Card */}
      <div className="bg-white p-4 lg:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="h-14 w-14 lg:h-16 lg:w-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
            <User className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl lg:text-3xl font-bold font-display text-primary-text leading-tight">
              {greeting}, {user?.full_name || 'Leader'}
            </h1>
            <p className="text-xs lg:text-sm text-gray-500 font-sans mt-0.5">
              Coordinator for the department report submissions.
            </p>
          </div>
        </div>

        <div className="flex flex-col text-left lg:text-right shrink-0">
          <span className="text-xxs font-semibold text-gray-400 uppercase tracking-widest">Reporting Period</span>
          <span className="text-base lg:text-lg font-bold text-primary-text font-display mt-0.5">
            {formatMonthLabel(currentMonthStr)}
          </span>
        </div>
      </div>

      {/* Telegram Link Warning Banner */}
      {user && !user.telegram_linked && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-start gap-3 shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="bg-amber-100 p-2 rounded-xl text-amber-800 shrink-0">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 font-display">Telegram Notifications Inactive</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Link your Telegram account to receive instant reminder alerts, deadline logs, and notifications directly.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/unit-head/settings')}
            className="w-full sm:w-auto text-center text-xs font-bold text-amber-900 hover:text-amber-950 underline px-3 py-2.5 rounded-lg hover:bg-amber-100/50 border border-amber-250 sm:border-transparent transition-colors shrink-0 cursor-pointer"
          >
            Link Bot Account
          </button>
        </div>
      )}

      {/* Grid Status Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Status Card */}
        <div className="bg-white p-5 lg:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-[14rem] space-y-6">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Submission Status</h3>
            {isLoadingReport ? (
              <div className="h-20 animate-shimmer rounded-xl"></div>
            ) : hasSubmitted ? (
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 text-green-custom p-3 rounded-2xl shrink-0">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <div className="text-xl lg:text-2xl font-bold text-green-700 font-display">Submitted Successfully</div>
                  <p className="text-xs text-gray-500 mt-1 font-sans">
                    Your monthly activity report has been compiled and saved.
                  </p>
                </div>
              </div>
            ) : isOverdue ? (
              <div className="flex items-center space-x-4">
                <div className="bg-red-100 text-danger-custom p-3 rounded-2xl shrink-0">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <div>
                  <div className="text-xl lg:text-2xl font-bold text-red-700 font-display">Overdue Submission</div>
                  <p className="text-xs text-gray-500 mt-1 font-sans">
                    The monthly deadline has passed and your report is currently missing.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <div className="bg-indigo-50 text-primary p-3 rounded-2xl shrink-0">
                  <Clock className="h-8 w-8" />
                </div>
                <div>
                  <div className="text-xl lg:text-2xl font-bold text-primary-text font-display">Pending Submission</div>
                  <p className="text-xs text-gray-500 mt-1 font-sans">
                    Your department report has not been submitted for this period.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-50 pt-4">
            <button
              onClick={() => navigate('/unit-head/report')}
              className="w-full h-12 min-h-[48px] flex items-center justify-between bg-primary text-white px-5 rounded-2xl hover:bg-indigo-800 transition-colors font-semibold shadow-sm cursor-pointer text-sm"
            >
              <span className="flex items-center">
                <FileInput className="h-4 w-4 mr-2 shrink-0" />
                {hasSubmitted ? 'Update Report Details' : 'Submit Monthly Report'}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Deadline Information Card */}
        <div className="bg-white p-5 lg:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-[14rem] space-y-6">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Submission Period Deadline</h3>
            {deadlineLoading ? (
              <div className="h-20 animate-shimmer rounded-xl"></div>
            ) : (
              <div className="space-y-2">
                <div className="text-2xl lg:text-3xl font-bold font-display text-primary-text">
                  {daysRemaining} Day(s) Left
                </div>
                <div className="text-sm font-semibold text-gray-600">
                  Due on: <span className="text-accent font-display">{deadline?.deadline_date ? new Date(deadline.deadline_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2 font-sans">
                  Once the first notification reminder is sent, the deadline date is locked in by system administration.
                </p>
              </div>
            )}
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-50/50 text-xs text-indigo-900 flex items-center space-x-2">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <span>Default deadlines fall on the 1st Saturday of the following calendar month.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Overview;
