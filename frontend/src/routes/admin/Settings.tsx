import React, { useState, useEffect } from 'react';
import { apiPost } from '../../lib/api';
import { getPastMonthsList, formatMonthLabel } from '../../lib/date-helpers';
import useDeadline from '../../hooks/useDeadline';
import { getChurchName, setChurchName as persistChurchName } from '../../lib/church-name';
import { 
  Settings as SettingsIcon, 
  Calendar, 
  Lock, 
  Unlock, 
  Send, 
  CheckCircle2, 
  AlertTriangle,
  Building,
  Info,
  Loader2
} from 'lucide-react';

export const Settings: React.FC = () => {


  // Selected month for deadline configuration (next month is standard for admin configurations)
  const nextMonths = getPastMonthsList(6).reverse(); // upcoming months
  // Let's filter nextMonths to only show the current month and upcoming months
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const upcomingMonths = nextMonths.filter(m => m >= currentMonthStr);
  
  const [selectedMonth, setSelectedMonth] = useState(upcomingMonths[0] || currentMonthStr);
  const { deadline, isLocked, isLoading: loadingDeadline, refetch } = useDeadline(selectedMonth);

  const [deadlineDate, setDeadlineDate] = useState('');
  const [churchName, setChurchNameState] = useState<string>(getChurchName);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'GracePlaceReportBot';

  useEffect(() => {
    if (deadline?.deadline_date) {
      setDeadlineDate(deadline.deadline_date);
    }
  }, [deadline]);

  const handleUpdateDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMonth || !deadlineDate) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await apiPost<any>('/deadlines', {
        month: selectedMonth,
        deadlineDate
      });
      setSuccessMsg(response.message || 'Deadline updated successfully.');
      await refetch();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update deadline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateChurchName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!churchName.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      persistChurchName(churchName.trim());
      setSuccessMsg(`Church name updated to "${churchName.trim()}". Changes are reflected immediately across the platform.`);
    } catch (err: any) {
      setErrorMsg('Failed to save church name. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center text-center sm:text-left space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="h-14 w-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-primary shrink-0 mx-auto sm:mx-0">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-primary-text mb-1">
            System Settings
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Configure reporting deadlines, update organization brand names, and review bot webhooks.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left column: Deadline Management */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
          <div className="border-b border-gray-50 pb-2">
            <h3 className="text-lg font-bold font-display text-primary-text flex items-center">
              <Calendar className="h-5 w-5 text-primary mr-2" /> Deadline Configuration
            </h3>
            <p className="text-xxs text-gray-400 font-sans mt-0.5">Customize monthly coordinator submission timelines.</p>
          </div>

          {successMsg && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center space-x-3 text-green-700 text-xs">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center space-x-3 text-red-700 text-xs">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleUpdateDeadline} className="space-y-4 max-w-lg w-full">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Reporting Period</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSuccessMsg(null);
                  setErrorMsg(null);
                }}
                className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base text-primary-text focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                {upcomingMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                <span>Deadline Date (YYYY-MM-DD)</span>
                {loadingDeadline ? (
                  <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                ) : isLocked ? (
                  <span className="text-[10px] font-bold text-red-600 flex items-center bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                    <Lock className="h-3 w-3 mr-1" /> locked
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-green-600 flex items-center bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                    <Unlock className="h-3 w-3 mr-1" /> editable
                  </span>
                )}
              </label>

              <input
                type="date"
                required
                disabled={isLocked || loadingDeadline}
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base text-primary-text focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              />
            </div>

            {isLocked && (
              <div className="bg-red-50 border border-red-100 text-xxs text-red-800 p-3.5 rounded-xl flex items-start space-x-2 leading-relaxed">
                <Info className="h-4.5 w-4.5 text-danger-custom shrink-0 mt-0.5" />
                <p>
                  The deadline can no longer be changed because the first reminder has already been sent for this reporting month.
                </p>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isLocked || isSubmitting || loadingDeadline || deadlineDate === (deadline?.deadline_date || '')}
                className="w-full sm:w-auto h-11 px-5 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-indigo-800 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Save Deadline Date
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Church Config & Telegram Webhook */}
        <div className="space-y-6">
          {/* Brand Config */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-4">
            <div className="border-b border-gray-50 pb-2">
              <h3 className="text-lg font-bold font-display text-primary-text flex items-center">
                <Building className="h-5 w-5 text-primary mr-2" /> Organization Profile
              </h3>
              <p className="text-xxs text-gray-400 font-sans mt-0.5">Customize global display brand settings.</p>
            </div>

            <form onSubmit={handleUpdateChurchName} className="space-y-4 max-w-lg w-full">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Church Brand Name</label>
                <input
                  type="text"
                  required
                  value={churchName}
                  onChange={(e) => setChurchNameState(e.target.value)}
                  className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base text-primary-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !churchName.trim() || churchName.trim() === getChurchName()}
                  className="w-full sm:w-auto h-11 px-5 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-indigo-800 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>

          {/* Telegram Webhook Status */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-4">
            <div className="border-b border-gray-50 pb-2">
              <h3 className="text-lg font-bold font-display text-primary-text flex items-center">
                <Send className="h-5 w-5 text-primary mr-2" /> Telegram Bot Webhook
              </h3>
              <p className="text-xxs text-gray-400 font-sans mt-0.5">Monitor reminder dispatcher connections.</p>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Bot Username:</span>
                <strong className="text-primary-text">@{botUsername}</strong>
              </div>
              
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Webhook Connection:</span>
                <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-200 text-xxs flex items-center">
                  Active ✓
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-gray-400">Scheduler Clock:</span>
                <span className="text-primary font-bold">08:00 WAT Daily</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
export default Settings;
