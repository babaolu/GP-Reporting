import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/api';
import { getPastMonthsList, formatMonthLabel } from '../../lib/date-helpers';
import { 
  BrainCircuit, 
  Calendar, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  ChevronRight, 
  TrendingUp, 
  FileText 
} from 'lucide-react';

interface SummaryData {
  id: string;
  month: string;
  overall_summary: string | null;
  common_issues: string[] | null;
  common_breakthroughs: string[] | null;
  critical_alerts: string[] | null;
  cross_unit_themes: string[] | null;
  unit_highlights: { unit_name: string; highlight: string }[] | null;
  ai_status: 'pending' | 'processing' | 'done' | 'failed';
}

export const Summaries: React.FC = () => {
  const months = getPastMonthsList(12);
  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const [activeTab, setActiveTab] = useState<'this-month' | 'trends' | 'themes'>('this-month');

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Lazy-loaded trends
  const [units, setUnits] = useState<any[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [unitTrend, setUnitTrend] = useState<any | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);

  const loadSummaryData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('monthly_summaries')
        .select('*')
        .eq('month', selectedMonth)
        .maybeSingle();

      if (!error && data) {
        setSummary(data as SummaryData);
      } else {
        setSummary(null);
      }
    } catch (err) {
      console.error('Failed to load monthly summaries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnitsForTrends = async () => {
    setLoadingUnits(true);
    try {
      const { data } = await supabase
        .from('units')
        .select('id, name')
        .neq('status', 'deactivated')
        .order('name', { ascending: true });
      setUnits(data || []);
    } catch (err) {
      console.error('Failed to load units for trends:', err);
    } finally {
      setLoadingUnits(false);
    }
  };

  useEffect(() => {
    loadSummaryData();
    if (activeTab === 'trends') {
      loadUnitsForTrends();
    }
  }, [selectedMonth, activeTab]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const response = await apiPost<{ summary: SummaryData }>('/ai/summarize-monthly', { month: selectedMonth });
      setSummary(response.summary);
    } catch (err: any) {
      alert(err.message || 'Summarization failed. Make sure at least one report has completed AI processing.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleToggleTrend = async (uId: string) => {
    if (expandedUnitId === uId) {
      setExpandedUnitId(null);
      setUnitTrend(null);
      return;
    }

    setExpandedUnitId(uId);
    setUnitTrend(null);
    setLoadingTrend(true);

    try {
      const data = await apiPost<any>('/ai/trend', { unitId: uId });
      setUnitTrend(data);
    } catch (err: any) {
      alert(err.message || 'No report history with completed AI summaries found for this unit.');
      setExpandedUnitId(null);
    } finally {
      setLoadingTrend(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Panel */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold font-display text-primary-text mb-1 flex items-center">
            <BrainCircuit className="h-8 w-8 text-primary mr-2" /> AI Monthly Insights
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            AI-driven monthly cross-department summarisation, trend mapping, and highlights.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <Calendar className="h-5 w-5 text-gray-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-200 rounded-xl text-sm px-4 py-2.5 text-primary-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('this-month')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'this-month' ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Executive Summary
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'trends' ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Department Trends
        </button>
        <button
          onClick={() => setActiveTab('themes')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'themes' ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Cross-Unit Themes
        </button>
      </div>

      {/* Content Viewports */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl min-h-[400px]">
        
        {/* TAB 1: EXECUTIVE SUMMARY */}
        {activeTab === 'this-month' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-display text-primary-text">Monthly Overview</h3>
              
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="px-4 py-2 bg-primary hover:bg-indigo-800 text-white disabled:opacity-50 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center shadow-md shadow-indigo-100"
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                )}
                Compile & Summarize
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : !summary ? (
              <div className="text-center py-12 text-gray-400 space-y-3">
                <BrainCircuit className="h-12 w-12 mx-auto" />
                <h4 className="text-base font-bold text-primary-text">No summary compiled for this period</h4>
                <p className="text-xs text-gray-500">Click the button above to run the AI compiler on current submissions.</p>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in text-primary-text font-sans">
                {/* Overall narrative */}
                <div className="space-y-2">
                  <span className="text-xxs font-bold text-gray-400 uppercase tracking-widest block">Executive Summary</span>
                  <p className="text-sm leading-relaxed text-justify">{summary.overall_summary}</p>
                </div>

                {/* Common Breakthroughs & Wins */}
                <div className="bg-green-50/50 border border-green-100 p-5 rounded-2xl space-y-2">
                  <h4 className="text-sm font-bold text-green-700 flex items-center font-display">
                    <CheckCircle className="h-4.5 w-4.5 mr-1.5" /> Breakthrough Highlights
                  </h4>
                  <ul className="list-disc pl-5 text-xs space-y-1.5">
                    {(summary.common_breakthroughs || []).map((b, i) => <li key={i}>{b}</li>)}
                    {(!summary.common_breakthroughs || summary.common_breakthroughs.length === 0) && <li>No common breakthroughs noted.</li>}
                  </ul>
                </div>

                {/* Common Issues & Challenges */}
                <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-2xl space-y-2">
                  <h4 className="text-sm font-bold text-amber-700 flex items-center font-display">
                    <AlertTriangle className="h-4.5 w-4.5 mr-1.5" /> Recurring Challenges
                  </h4>
                  <ul className="list-disc pl-5 text-xs space-y-1.5">
                    {(summary.common_issues || []).map((is, i) => <li key={i}>{is}</li>)}
                    {(!summary.common_issues || summary.common_issues.length === 0) && <li>No repeating challenges reported.</li>}
                  </ul>
                </div>

                {/* Critical Alerts Banner */}
                {summary.critical_alerts && summary.critical_alerts.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-5 rounded-2xl space-y-2 text-red-800">
                    <h4 className="text-sm font-bold flex items-center font-display">
                      <AlertTriangle className="h-4.5 w-4.5 mr-1.5 text-danger-custom" /> Critical Action Items
                    </h4>
                    <ul className="list-disc pl-5 text-xs space-y-1.5">
                      {summary.critical_alerts.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LAZY LOADED DEPARTMENT TRENDS */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold font-display text-primary-text mb-4">Department Trends (6-Month History)</h3>

            {loadingUnits ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {units.map(u => {
                  const isExpanded = expandedUnitId === u.id;
                  return (
                    <div key={u.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-xxs">
                      {/* Accordion header */}
                      <button
                        onClick={() => handleToggleTrend(u.id)}
                        className={`w-full flex items-center justify-between p-4 text-left font-bold text-sm text-primary-text hover:bg-gray-50 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-indigo-50/20' : 'bg-white'
                        }`}
                      >
                        <span className="flex items-center font-display text-base">
                          <TrendingUp className="h-4.5 w-4.5 mr-2 text-primary" /> {u.name}
                        </span>
                        <ChevronRight className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-primary' : 'text-gray-400'}`} />
                      </button>

                      {/* Accordion body */}
                      {isExpanded && (
                        <div className="p-5 bg-white border-t border-gray-50 space-y-4 animate-fade-in text-xs leading-normal">
                          {loadingTrend ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-6 w-6 text-primary animate-spin" />
                              <span className="text-xs text-gray-400 ml-1.5">Generating trend model...</span>
                            </div>
                          ) : unitTrend ? (
                            <div className="space-y-4 text-primary-text">
                              <div className="flex items-center justify-between text-xs">
                                <strong>Progress Status:</strong>
                                <span className={`text-xxs font-bold uppercase px-2 py-0.5 rounded-full border ${
                                  unitTrend.momentum === 'positive' 
                                    ? 'bg-green-50 text-green-700 border-green-200' 
                                    : unitTrend.momentum === 'concerning'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {unitTrend.momentum}
                                </span>
                              </div>
                              
                              <p className="font-sans leading-relaxed text-justify bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                {unitTrend.trend_narrative}
                              </p>

                              {unitTrend.persisting_issues?.length > 0 && (
                                <div>
                                  <strong className="text-red-700 block mb-1">Persisting Issues:</strong>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {unitTrend.persisting_issues.map((pi: string, idx: number) => <li key={idx}>{pi}</li>)}
                                  </ul>
                                </div>
                              )}

                              {unitTrend.resolved_issues?.length > 0 && (
                                <div>
                                  <strong className="text-green-700 block mb-1">Resolved Issues:</strong>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {unitTrend.resolved_issues.map((ri: string, idx: number) => <li key={idx}>{ri}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 py-4">No trend data fetched.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CROSS UNIT THEMES */}
        {activeTab === 'themes' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold font-display text-primary-text mb-4">Cross-Department Recurring Themes</h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : !summary ? (
              <div className="text-center py-12 text-gray-400">No cross-unit summaries loaded.</div>
            ) : (
              <div className="space-y-6 text-primary-text animate-fade-in font-sans">
                {/* Themes List */}
                <div className="space-y-3">
                  <span className="text-xxs font-bold text-gray-400 uppercase tracking-widest block">Core Patterns & Dependencies</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(summary.cross_unit_themes || []).map((theme, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/50 flex items-start space-x-2">
                        <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-xs leading-relaxed">{theme}</span>
                      </div>
                    ))}
                    {(!summary.cross_unit_themes || summary.cross_unit_themes.length === 0) && (
                      <div className="col-span-2 text-center py-6 text-xs text-gray-400">No common themes highlighted.</div>
                    )}
                  </div>
                </div>

                {/* Highlights Table/List */}
                {summary.unit_highlights && summary.unit_highlights.length > 0 && (
                  <div className="space-y-3 pt-6 border-t border-gray-100">
                    <span className="text-xxs font-bold text-gray-400 uppercase tracking-widest block">Unit Quick Highlights</span>
                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                      {summary.unit_highlights.map((h, i) => (
                        <div key={i} className="p-4 bg-white hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between text-xs space-y-1 sm:space-y-0">
                          <strong className="text-primary-text font-display font-bold text-sm shrink-0 sm:w-1/4">{h.unit_name}</strong>
                          <span className="text-gray-600 sm:w-3/4 text-left">{h.highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
export default Summaries;
