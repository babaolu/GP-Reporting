import React, { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import { getPastMonthsList, formatMonthLabel } from '../../lib/date-helpers';
import { 
  Trophy, 
  Calendar, 
  TrendingUp, 
  Loader2 
} from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  unitId: string;
  unitName: string;
  headName: string | null;
  consistencyScore: number;
  onTimeSubmissions: number;
  totalActiveMonths: number;
  averageLeadTimeMs: number;
  averageCompleteness: number;
  leadTimeHours: number;
}

export const Leaderboard: React.FC = () => {
  const months = getPastMonthsList(12);
  const [selectedMonth, setSelectedMonth] = useState(months[0]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<LeaderboardEntry[]>(`/leaderboard?month=${selectedMonth}`);
      setLeaderboard(data);
    } catch (err: any) {
      console.error('Failed to load leaderboard data:', err);
      setError(err.message || 'Failed to retrieve consistency scores.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [selectedMonth]);

  // Identify top 3 entries
  const topThree = leaderboard.slice(0, 3);
  const remainder = leaderboard.slice(3);

  // Check if there are any ties in consistencyScore to show the tiebreaker warning
  const hasTies = () => {
    if (leaderboard.length < 2) return false;
    for (let i = 0; i < leaderboard.length - 1; i++) {
      if (leaderboard[i].consistencyScore === leaderboard[i + 1].consistencyScore) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="bg-white p-6 lg:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold font-display text-primary-text mb-1 flex items-center">
            <Trophy className="h-8 w-8 text-accent mr-2 shrink-0" /> Department Leaderboard
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Ranked consistency and completeness tracking scores across active department units.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0 w-full lg:w-auto">
          <Calendar className="h-5 w-5 text-gray-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full lg:w-auto border border-gray-200 rounded-xl text-sm px-4 py-2 text-primary-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)} Standings
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-xs text-gray-500 mt-2">Compiling consistency leaderboard...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center">
          {error}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 shadow-sm">
          No active departments configured.
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Tiebreaker Alert banner */}
          {hasTies() && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center space-x-3 text-xs text-indigo-900 leading-normal">
              <TrendingUp className="h-5 w-5 text-primary shrink-0" />
              <span>
                <strong>Note on Tiebreaker:</strong> Department units with matching consistency scores are ranked based on their **earliest average submission lead time** relative to the monthly deadline.
              </span>
            </div>
          )}

          {/* TOP 3 PODIUM DISPLAY */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {topThree.map((unit, idx) => {
                const podiumColors = [
                  { bg: 'from-amber-100 to-yellow-50 border-yellow-200 text-yellow-800', badge: 'bg-yellow-400 text-yellow-950', size: 'lg:scale-105 shadow-md shadow-yellow-50' }, // 1st Place (Gold)
                  { bg: 'from-slate-100 to-gray-50 border-gray-200 text-slate-800', badge: 'bg-gray-400 text-gray-950', size: 'shadow-sm shadow-gray-50' },          // 2nd Place (Silver)
                  { bg: 'from-orange-100 to-amber-50 border-orange-200 text-orange-800', badge: 'bg-orange-400 text-orange-950', size: 'shadow-sm shadow-orange-50' }       // 3rd Place (Bronze)
                ];

                const currentStyle = podiumColors[idx] || podiumColors[1];

                return (
                  <div
                    key={unit.unitId}
                    className={`bg-gradient-to-br p-6 rounded-3xl border text-center flex flex-col justify-between items-center space-y-4 ${currentStyle.bg} ${currentStyle.size}`}
                  >
                    <div>
                      <span className={`text-xxs font-extrabold uppercase px-3 py-1 rounded-full ${currentStyle.badge}`}>
                        Rank {idx + 1}
                      </span>
                      <h3 className="text-xl font-bold font-display text-primary-text mt-3 truncate max-w-[200px]">
                        {unit.unitName}
                      </h3>
                      <p className="text-xxs text-gray-500 font-sans">
                        Coordinator: {unit.headName || 'Not Assigned'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="text-4xl font-extrabold font-mono text-primary-text">{unit.consistencyScore}</div>
                      <span className="text-xxs font-bold text-gray-400 uppercase tracking-widest block">Consistency Points</span>
                    </div>

                    <div className="flex justify-between w-full text-xxs text-gray-500 pt-3 border-t border-indigo-900/10">
                      <span>On-Time: <strong>{unit.onTimeSubmissions}/{unit.totalActiveMonths}</strong></span>
                      <span>Quality Avg: <strong>{unit.averageCompleteness}/5</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE OF REMAINING RANKS */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-indigo-950 text-indigo-100 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-4 px-6">Rank</th>
                    <th className="py-4 px-6">Department</th>
                    <th className="py-4 px-6">Coordinator</th>
                    <th className="py-4 px-6 text-center">Consistency Score</th>
                    <th className="py-4 px-6 text-center">On-Time Submissions</th>
                    <th className="py-4 px-6 text-center">AI Quality Avg</th>
                    <th className="py-4 px-6 text-right">Average Lead Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {remainder.map((entry) => (
                    <tr key={entry.unitId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <span className={`font-bold font-mono h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                          entry.rank === 1 ? 'bg-yellow-400 text-yellow-950 font-extrabold' :
                          entry.rank === 2 ? 'bg-gray-400 text-gray-950 font-extrabold' :
                          entry.rank === 3 ? 'bg-orange-400 text-orange-950 font-extrabold' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {entry.rank}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-primary-text">{entry.unitName}</td>
                      <td className="py-4 px-6 text-gray-500">{entry.headName || 'Not Assigned'}</td>
                      <td className="py-4 px-6 text-center font-extrabold font-mono text-primary">{entry.consistencyScore}</td>
                      <td className="py-4 px-6 text-center text-gray-500">{entry.onTimeSubmissions} / {entry.totalActiveMonths} months</td>
                      <td className="py-4 px-6 text-center font-semibold text-gray-600">{entry.averageCompleteness} / 5</td>
                      <td className="py-4 px-6 text-right text-gray-400 font-sans text-xs">
                        {entry.leadTimeHours > 0 ? `${entry.leadTimeHours} hrs ahead` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block lg:hidden p-4 space-y-4">
              {remainder.map((entry) => (
                <div key={entry.unitId} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className={`font-bold font-mono h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs ${
                      entry.rank === 1 ? 'bg-yellow-400 text-yellow-950 font-extrabold' :
                      entry.rank === 2 ? 'bg-gray-400 text-gray-950 font-extrabold' :
                      entry.rank === 3 ? 'bg-orange-400 text-orange-950 font-extrabold' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {entry.rank}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-primary-text truncate text-sm">{entry.unitName}</h4>
                      <p className="text-xs text-gray-500 truncate">Coordinator: {entry.headName || 'Not Assigned'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-extrabold font-mono text-primary text-base">{entry.consistencyScore} pts</div>
                    <p className="text-[10px] text-gray-400">On-Time: {entry.onTimeSubmissions}/{entry.totalActiveMonths}m | Quality: {entry.averageCompleteness}/5</p>
                  </div>
                </div>
              ))}
              {remainder.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">No remaining department rankings.</p>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
export default Leaderboard;
