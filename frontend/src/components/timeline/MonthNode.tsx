import React from 'react';
import { Check, Clock, X, Minus } from 'lucide-react';
import { formatMonthLabel } from '../../lib/date-helpers';

interface MonthNodeProps {
  month: string;
  status: 'on_time' | 'late' | 'missing' | 'future';
  submittedAt?: string;
  version?: number;
  onClick?: () => void;
}

export const MonthNode: React.FC<MonthNodeProps> = ({
  month,
  status,
  submittedAt,
  version = 1,
  onClick
}) => {
  const label = formatMonthLabel(month);

  const config = {
    on_time: {
      bg: 'bg-green-50 border-green-200',
      iconBg: 'bg-green-500',
      icon: Check,
      badgeText: 'On Time',
      badgeStyle: 'bg-green-100 text-green-800 border-green-200',
      cursor: 'cursor-pointer'
    },
    late: {
      bg: 'bg-amber-50 border-amber-200',
      iconBg: 'bg-amber-500',
      icon: Clock,
      badgeText: `Late (v${version})`,
      badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200',
      cursor: 'cursor-pointer'
    },
    missing: {
      bg: 'bg-red-50/50 border-red-200 border-dashed',
      iconBg: 'bg-red-500 animate-pulse border-2 border-white shadow-md shadow-red-100',
      icon: X,
      badgeText: 'Missing',
      badgeStyle: 'bg-red-100 text-red-800 border-red-200',
      cursor: 'cursor-default'
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

  const isClickable = status === 'on_time' || status === 'late';

  return (
    <div 
      onClick={isClickable ? onClick : undefined}
      className={`border rounded-2xl p-5 flex items-center justify-between transition-all duration-300 ${current.bg} ${current.cursor} ${
        isClickable ? 'hover:scale-98 hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-center space-x-4">
        {/* Node Circle Icon */}
        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0 ${current.iconBg}`}>
          <IconComponent className="h-5 w-5" />
        </div>
        
        <div>
          <h4 className="text-base font-bold text-primary-text font-display leading-tight">{label}</h4>
          {status === 'missing' && (
            <p className="text-xs text-red-600 mt-1 font-semibold">
              No report submitted for this month.
            </p>
          )}
          {submittedAt && (
            <p className="text-xs text-gray-500 mt-0.5 font-sans">
              Submitted at: {new Date(submittedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end space-y-1">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${current.badgeStyle}`}>
          {current.badgeText}
        </span>
      </div>
    </div>
  );
};
export default MonthNode;
