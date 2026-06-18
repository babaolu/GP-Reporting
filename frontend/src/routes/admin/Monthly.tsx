import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/api';
import { getPastMonthsList, formatMonthLabel } from '../../lib/date-helpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Calendar, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Award, 
  Loader2,
  X
} from 'lucide-react';

interface ReportRow {
  unitId: string;
  unitName: string;
  headName: string | null;
  report: any | null;
  status: 'submitted' | 'late' | 'pending';
}

export const Monthly: React.FC = () => {
  const months = getPastMonthsList(12);
  const [selectedMonth, setSelectedMonth] = useState(months[0]);

  const [reportsData, setReportsData] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

  // Comments for expanded report
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Export Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // General monthly AI summary status
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);

  const loadMonthlyReports = async () => {
    setIsLoading(true);
    setExpandedUnitId(null);
    try {
      // 1. Fetch units
      const { data: units } = await supabase
        .from('units')
        .select('*')
        .neq('status', 'deactivated')
        .order('name', { ascending: true });

      // 2. Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('full_name, unit_id')
        .eq('role', 'unit_head');

      // 3. Fetch reports for selectedMonth
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('month', selectedMonth)
        .eq('is_latest', true);

      if (units) {
        const headMap = new Map<string, string>();
        if (profiles) {
          profiles.forEach(p => {
            if (p.unit_id) headMap.set(p.unit_id, p.full_name || 'Unit Head');
          });
        }

        const reportMap = new Map<string, any>();
        if (reports) {
          reports.forEach(r => {
            reportMap.set(r.unit_id, r);
          });
        }

        const compiled: ReportRow[] = units.map(u => {
          const report = reportMap.get(u.id) || null;
          const headName = headMap.get(u.id) || null;

          let status: 'submitted' | 'late' | 'pending' = 'pending';
          if (report) {
            status = report.is_late ? 'late' : 'submitted';
          }

          return {
            unitId: u.id,
            unitName: u.name,
            headName,
            report,
            status
          };
        });

        setReportsData(compiled);
      }
    } catch (err) {
      console.error('Failed to load monthly reports data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyReports();
  }, [selectedMonth]);

  const toggleExpandRow = async (unitId: string, reportId: string | null) => {
    if (expandedUnitId === unitId) {
      setExpandedUnitId(null);
      setComments([]);
      return;
    }

    setExpandedUnitId(unitId);
    setComments([]);
    setNewCommentText('');

    if (reportId) {
      try {
        const { data } = await supabase
          .from('report_comments')
          .select('*, profiles(full_name)')
          .eq('report_id', reportId)
          .order('created_at', { ascending: true });

        setComments(data || []);
      } catch (err) {
        console.error('Failed to load comments:', err);
      }
    }
  };

  const handlePostComment = async (reportId: string) => {
    if (!newCommentText.trim() || !reportId) return;
    setIsPostingComment(true);

    try {
      const result = await apiPost<any>(`/reports/${reportId}/comments`, {
        comment: newCommentText.trim()
      });
      setComments(prev => [...prev, result]);
      setNewCommentText('');
    } catch (err) {
      alert('Failed to post feedback comment.');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleExportMonth = async () => {
    setIsExporting(true);
    setDownloadUrl(null);
    try {
      const response = await apiPost<{ downloadUrl: string }>('/export/monthly', {
        month: selectedMonth,
        format: exportFormat
      });
      setDownloadUrl(response.downloadUrl);
    } catch (err: any) {
      alert(err.message || 'Export generation failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRegenerateMonthlySummary = async () => {
    setIsRegeneratingSummary(true);
    try {
      await apiPost('/ai/summarize-monthly', { month: selectedMonth });
      alert('Monthly cross-unit AI summary generated/regenerated successfully! ✓');
    } catch (err: any) {
      alert(err.message || 'Summarization failed. Make sure at least one report has completed AI processing.');
    } finally {
      setIsRegeneratingSummary(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold font-display text-primary-text mb-1">
            Monthly Submissions Review
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Review detailed unit submissions, read AI reports, write comments, and export monthly packages.
          </p>
        </div>

        <div className="flex space-x-3 shrink-0">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-primary hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center"
          >
            <Download className="h-4 w-4 mr-1.5" /> Export This Month
          </button>
          
          <button
            onClick={handleRegenerateMonthlySummary}
            disabled={isRegeneratingSummary}
            className="px-4 py-2.5 bg-primary text-white hover:bg-indigo-800 disabled:opacity-50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center"
          >
            {isRegeneratingSummary ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1.5" />
            )}
            Regenerate Summary
          </button>
        </div>
      </div>

      {/* Period Selection */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-3">
        <Calendar className="h-5 w-5 text-gray-400" />
        <span className="text-sm font-semibold text-gray-500">Select reporting period: </span>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border border-gray-200 rounded-xl text-sm px-4 py-2 text-primary-text focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {/* Reports Table Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-xs text-gray-500 mt-2">Loading monthly submissions...</span>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-indigo-950 text-indigo-100 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Coordinator</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Submitted Date</th>
                  <th className="py-4 px-6">AI Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportsData.map((row) => {
                  const isExpanded = expandedUnitId === row.unitId;
                  
                  const statusConfigs = {
                    submitted: { text: 'On Time', style: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
                    late: { text: 'Late', style: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
                    pending: { text: 'Pending', style: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock }
                  };

                  const currentStatus = statusConfigs[row.status];
                  const StatusIcon = currentStatus.icon;

                  return (
                    <React.Fragment key={row.unitId}>
                      {/* Main Row */}
                      <tr 
                        onClick={() => toggleExpandRow(row.unitId, row.report?.id)}
                        className={`hover:bg-indigo-50/20 transition-colors cursor-pointer text-sm ${
                          isExpanded ? 'bg-indigo-50/10' : ''
                        }`}
                      >
                        <td className="py-4 px-6 font-bold text-primary-text">{row.unitName}</td>
                        <td className="py-4 px-6 text-gray-500">{row.headName || 'Not Assigned'}</td>
                        <td className="py-4 px-6">
                          <span className={`text-xxs font-bold px-2 py-0.5 rounded-full border flex items-center w-fit space-x-1 ${currentStatus.style}`}>
                            <StatusIcon className="h-3 w-3 mr-0.5" /> {currentStatus.text}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-400">
                          {row.report ? new Date(row.report.submitted_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-4 px-6">
                          {row.report ? (
                            <span className={`text-xxs font-bold px-2 py-0.5 rounded-full border uppercase ${
                              row.report.ai_status === 'done' 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                : row.report.ai_status === 'processing'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100 animate-pulse'
                                : row.report.ai_status === 'failed'
                                ? 'bg-red-50 text-red-700 border-red-100'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}>
                              {row.report.ai_status}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-4 px-6 text-right text-primary font-bold flex items-center justify-end">
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </td>
                      </tr>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-gray-50/50 p-6 border-t border-b border-indigo-100/30">
                            {!row.report ? (
                              <div className="text-center py-6 text-xs text-gray-400">
                                No report submitted by this department for the reporting period.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in text-primary-text">
                                {/* Left side: Report Content */}
                                <div className="space-y-4">
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Report Text</h4>
                                  <div className="prose max-w-none text-xs bg-white p-5 rounded-2xl border border-gray-100 h-96 overflow-y-auto font-sans shadow-xxs">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {row.report.content_text || row.report.parsed_text || '*No text content. Report was parsed from file.*'}
                                    </ReactMarkdown>
                                  </div>
                                  
                                  {row.report.file_url && (
                                    <div className="text-xs text-gray-500 font-sans">
                                      Parsed Attachment File:{' '}
                                      <a
                                        href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/reports/${row.report.file_url}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary font-bold underline ml-1"
                                      >
                                        Download {row.report.file_type?.toUpperCase()} File
                                      </a>
                                    </div>
                                  )}
                                </div>

                                {/* Right side: AI Summary & Feedback Comments */}
                                <div className="space-y-6">
                                  {/* AI Summary insights */}
                                  <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4 shadow-xxs">
                                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">AI Report Summary</h4>
                                      {row.report.ai_summary && (
                                        <span className="text-xxs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center">
                                          <Award className="h-3 w-3 mr-0.5 text-accent" /> Score: {row.report.ai_summary.completeness_score}/5
                                        </span>
                                      )}
                                    </div>

                                    {row.report.ai_status === 'processing' ? (
                                      <div className="space-y-3 animate-pulse">
                                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                        <div className="h-10 bg-gray-200 rounded"></div>
                                      </div>
                                    ) : row.report.ai_status === 'failed' ? (
                                      <div className="text-center py-4 text-xs text-amber-700 bg-amber-50 rounded-xl flex items-center justify-center space-x-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span>AI processing failed. Insights unavailable.</span>
                                      </div>
                                    ) : row.report.ai_summary ? (
                                      <div className="space-y-3 text-xs leading-relaxed leading-normal font-sans">
                                        <p><strong>Summary:</strong> {row.report.ai_summary.summary}</p>
                                        
                                        {row.report.ai_summary.breakthroughs?.length > 0 && (
                                          <div>
                                            <strong>Wins:</strong>
                                            <ul className="list-disc pl-4 mt-0.5">
                                              {row.report.ai_summary.breakthroughs.map((b: string, i: number) => <li key={i}>{b}</li>)}
                                            </ul>
                                          </div>
                                        )}

                                        {row.report.ai_summary.issues?.length > 0 && (
                                          <div>
                                            <strong>Issues:</strong>
                                            <ul className="list-disc pl-4 mt-0.5">
                                              {row.report.ai_summary.issues.map((is: string, i: number) => <li key={i}>{is}</li>)}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-center text-xs text-gray-400 py-4">No AI summary generated.</div>
                                    )}
                                  </div>

                                  {/* Comments Section */}
                                  <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4 shadow-xxs">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Feedback Comments</h4>
                                    
                                    <div className="space-y-3 max-h-48 overflow-y-auto">
                                      {comments.length === 0 ? (
                                        <div className="text-center text-xxs text-gray-400 py-4">No feedback left on this report.</div>
                                      ) : (
                                        comments.map(c => (
                                          <div key={c.id} className="bg-gray-50 p-2.5 rounded-xl text-xxs flex flex-col space-y-1">
                                            <div className="flex items-center justify-between text-gray-400">
                                              <strong>{c.profiles?.full_name || 'Admin'}</strong>
                                              <span>{new Date(c.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-gray-600 font-sans">{c.comment}</p>
                                          </div>
                                        ))
                                      )}
                                    </div>

                                    {/* Leave a comment */}
                                    <div className="pt-2 border-t border-gray-50 flex items-center space-x-2">
                                      <input
                                        type="text"
                                        placeholder="Add inline feedback comment..."
                                        value={newCommentText}
                                        onChange={(e) => setNewCommentText(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-primary-text"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handlePostComment(row.report.id)}
                                        disabled={isPostingComment || !newCommentText.trim()}
                                        className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-indigo-800 disabled:opacity-50 transition-colors flex items-center cursor-pointer"
                                      >
                                        {isPostingComment && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                        Post
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowExportModal(false)} />
          <div className="bg-white max-w-sm w-full p-6 rounded-3xl shadow-2xl border border-gray-100 relative z-10 animate-scale-in space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold font-display text-primary-text">Export Report Package</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Select Export Format</label>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => { setExportFormat('pdf'); setDownloadUrl(null); }}
                  className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    exportFormat === 'pdf' 
                      ? 'bg-primary text-white border-primary shadow-sm' 
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  PDF Document (.pdf)
                </button>
                
                <button
                  type="button"
                  onClick={() => { setExportFormat('docx'); setDownloadUrl(null); }}
                  className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    exportFormat === 'docx' 
                      ? 'bg-primary text-white border-primary shadow-sm' 
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  Word Document (.docx)
                </button>
              </div>

              {downloadUrl && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-center space-y-2 animate-fade-in text-xs text-green-700">
                  <p>Document compiled successfully! ✓</p>
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-primary underline block text-sm"
                  >
                    Click to Download Document
                  </a>
                </div>
              )}
            </div>

            <div className="flex space-x-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-2 text-xs font-semibold border border-gray-300 text-gray-500 rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              
              {!downloadUrl && (
                <button
                  onClick={handleExportMonth}
                  disabled={isExporting}
                  className="flex-1 py-2 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-indigo-800 disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  Compile & Export
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default Monthly;
