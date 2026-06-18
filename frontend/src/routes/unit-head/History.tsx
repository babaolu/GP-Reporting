import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import ReportTimeline from '../../components/timeline/ReportTimeline';
import { History as HistoryIcon } from 'lucide-react';

export const History: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
        <div className="h-14 w-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-primary shrink-0">
          <HistoryIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-primary-text mb-1">
            Submission History
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Review your unit's report submissions, AI analysis insights, and admin feedback across the last 6 months.
          </p>
        </div>
      </div>

      {/* Timeline Render Container */}
      {user?.unit_id ? (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
          <ReportTimeline unitId={user.unit_id} />
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center text-amber-800">
          This account is not currently assigned to a church department unit. Please contact the administrator.
        </div>
      )}
    </div>
  );
};
export default History;
