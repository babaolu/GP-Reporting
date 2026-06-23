import React from 'react';
import { Check, Clock, X, Minus } from 'lucide-react';
import { formatMonthLabel } from '../../lib/date-helpers';

interface MonthNodeProps {
  month: string;
  status: 'on_time' | 'late' | 'missing' | 'future';
  submittedAt?: string;
  version?: number;
  onClick?: () => void;
  unitName?: string;
  aiSummaryPreview?: string;
  isActionable?: boolean;
}

export const MonthNode: React.FC<MonthNodeProps> = ({
  month,
  status,
  submittedAt,
  version = 1,
  onClick,
  unitName,
  aiSummaryPreview,
  isActionable = false
}) => {
  const label = formatMonthLabel(month);

  const config = {
    on_time: {
      bg: 'bg-green-50/70 border-green-200',
      iconBg: 'bg-green-500',
      icon: Check,
      badgeText: 'On Time',
      badgeStyle: 'bg-green-100 text-green-800 border-green-200',
      cursor: 'cursor-pointer'
    },
    late: {
      bg: 'bg-amber-50/70 border-amber-200',
      iconBg: 'bg-amber-500',
      icon: Clock,
      badgeText: `Late (v${version})`,
      badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200',
      cursor: 'cursor-pointer'
    },
    missing: {
      bg: 'bg-red-50/30 border-red-200 border-dashed',
      iconBg: 'bg-red-500 animate-pulse border-2 border-white shadow-md shadow-red-100',
      icon: X,
      badgeText: 'Missing',
      badgeStyle: 'bg-red-100 text-red-800 border-red-200',
      cursor: isActionable ? 'cursor-pointer' : 'cursor-default'
    },
    future: {
      bg: 'bg-gray-50 border-gray-200',
      iconBg: 'bg-gray-400',
      icon: Minus,
      badgeText: 'Not Open',
      badgeStyle: 'bg-gray-100 text-gray-800 border-gray-200',
      cursor: 'cursor-default'
    }
  };

  const current = config[status];
  const IconComponent = current.icon;
  const isClickable = status === 'on_time' || status === 'late' || (status === 'missing' && isActionable);

  return (
    <div className="relative flex items-center min-h-[44px]">
      {/* Node Circle Icon (flush left, absolute positioned relative to the timeline item) */}
      <div 
        className={`absolute left-4 -translate-x-1/2 lg:left-10 h-8 w-8 lg:h-10 lg:w-10 rounded-full flex items-center justify-center text-white shrink-0 z-10 border-2 border-white shadow-sm ${current.iconBg}`}
      >
        <IconComponent className="h-4 w-4 lg:h-5 lg:w-5" />
      </div>

      {/* Node Card - pushed right of the connector line */}
      <div 
        onClick={isClickable ? onClick : undefined}
        className={`w-full border rounded-2xl p-3 lg:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ml-10 lg:ml-20 ${current.bg} ${current.cursor} ${
          isClickable ? 'hover:scale-98 hover:shadow-md' : ''
        }`}
      >
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-2">
            <h4 className="text-base lg:text-lg font-bold text-primary-text font-display leading-tight">
              {label}
            </h4>
            {unitName && (
              <span className="text-xxs font-semibold text-gray-400">
                — {unitName}
              </span>
            )}
          </div>

          {/* AI Summary Preview if available */}
          {aiSummaryPreview && (
            <p className="text-xs text-gray-600 line-clamp-2 md:line-clamp-1 font-sans leading-relaxed">
              {aiSummaryPreview}
            </p>
          )}

          {status === 'missing' && (
            <>
              <p className="text-xs text-red-600 font-semibold">
                No report submitted for this month.
              </p>
              {isActionable && (
                <p className="text-xs text-red-500 font-semibold mt-1 flex items-center space-x-1">
                  <span>→</span>
                  <span>Tap to submit a late report</span>
                </p>
              )}
            </>
          )}

          {submittedAt && (
            <p className="text-xxs text-gray-400 font-sans">
              Submitted: {new Date(submittedAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex shrink-0 self-start sm:self-center">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${current.badgeStyle}`}>
            {current.badgeText}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MonthNode;
