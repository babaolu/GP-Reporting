import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { apiPost } from '../../lib/api';
import { formatMonthLabel } from '../../lib/date-helpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, CheckCircle, Clock, MessageSquare, History, Award, AlertTriangle, Loader2 } from 'lucide-react';

interface ReportSlideOverProps {
  reportId: string;
  onClose: () => void;
}

export const ReportSlideOver: React.FC<ReportSlideOverProps> = ({ reportId, onClose }) => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'content' | 'ai' | 'comments'>('content');
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<any | null>(null);

  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsPostingComment(true);
    try {
      const result = await apiPost<any>(`/reports/${selectedVersionId}/comments`, {
        comment: newComment.trim()
      });
      setComments(prev => [...prev, result]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
      alert('Failed to post comment.');
    } finally {
      setIsPostingComment(false);
    }
  };
  
  // Versions and comments
  const [versions, setVersions] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(reportId);

  // Fetch report details
  const fetchReportDetails = async (idToFetch: string) => {
    setIsLoading(true);
    try {
      // 1. Fetch specific report version
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*, units(name)')
        .eq('id', idToFetch)
        .single();

      if (reportError || !reportData) {
        console.error('Failed to load report detail:', reportError);
        return;
      }
      setReport(reportData);

      // 2. Fetch all versions for this unit and month
      const { data: versionList } = await supabase
        .from('reports')
        .select('id, version, is_late, submitted_at')
        .eq('unit_id', reportData.unit_id)
        .eq('month', reportData.month)
        .order('version', { ascending: false });

      if (versionList) {
        setVersions(versionList);
      }

      // 3. Fetch comments for this specific version
      const { data: commentsList } = await supabase
        .from('report_comments')
        .select('*, profiles(full_name, avatar_url)')
        .eq('report_id', idToFetch)
        .order('created_at', { ascending: true });

      if (commentsList) {
        setComments(commentsList);
      }

    } catch (err) {
      console.error('Error fetching report details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (reportId) {
      setSelectedVersionId(reportId);
      fetchReportDetails(reportId);
    }
  }, [reportId]);

  // If a different version is clicked in the history list, reload details
  const handleVersionClick = (vId: string) => {
    setSelectedVersionId(vId);
    fetchReportDetails(vId);
  };

  // Prevent body scroll when open (scroll trap)
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  if (!reportId) return null;

  return (
    <div className="fixed inset-0 overflow-hidden z-50 animate-fade-in flex flex-col justify-end lg:justify-start">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose} />
      
      {/* Inner panel: bottom sheet on mobile, right panel on desktop */}
      <div className="relative w-full bg-white flex flex-col h-[90vh] rounded-t-3xl shadow-2xl border-t border-gray-200 animate-slide-up-bottom lg:h-full lg:w-screen lg:max-w-2xl lg:rounded-none lg:border-t-0 lg:border-l lg:border-gray-100 lg:animate-slide-in lg:self-end">
        {/* Drag handle bar at top on mobile */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-2.5 shrink-0 lg:hidden" />

        {/* Header */}
        <div className="bg-indigo-950 p-5 mt-2 lg:mt-0 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold font-display leading-tight">
              {report?.units?.name || 'Department Report'}
            </h2>
            <p className="text-xs text-indigo-300 mt-1 font-sans">
              {report ? formatMonthLabel(report.month) : ''}  |  Version {report?.version || 1}
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-2.5 rounded-full hover:bg-indigo-900/50 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <span className="text-xs text-gray-500 mt-2">Loading report details...</span>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-100 bg-gray-50">
                <button
                  onClick={() => setActiveTab('content')}
                  className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-all cursor-pointer ${
                    activeTab === 'content' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Report Content
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-all cursor-pointer ${
                    activeTab === 'ai' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  AI Summary
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-all cursor-pointer ${
                    activeTab === 'comments' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Comments ({comments.length})
                </button>
              </div>

              {/* Scrollable Content View */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* TAB 1: REPORT CONTENT */}
                {activeTab === 'content' && (
                  <div className="space-y-6">
                    {/* Status Box */}
                    <div className={`p-4 rounded-xl flex items-center space-x-3 border ${
                      report.is_late 
                        ? 'bg-amber-50 border-amber-200 text-amber-800' 
                        : 'bg-green-50 border-green-200 text-green-800'
                    }`}>
                      {report.is_late ? <Clock className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                      <span className="text-sm font-semibold">
                        {report.is_late 
                          ? `Submitted Late (Revision ${report.version})` 
                          : `Submitted On-Time (Version ${report.version})`}
                      </span>
                    </div>

                    {/* Markdown Renderer */}
                    <div className="prose max-w-none text-primary-text font-sans">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {report.content_text || report.parsed_text || '*No plain text content. Report was parsed from file.*'}
                      </ReactMarkdown>
                    </div>

                    {report.file_url && (
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-sans">
                          Parsed File Attachment: <strong>{report.file_type?.toUpperCase()} Format</strong>
                        </span>
                        <a
                          href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/reports/${report.file_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-primary underline"
                        >
                          Download Original File
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: AI SUMMARY PANEL */}
                {activeTab === 'ai' && (
                  <div className="space-y-6">
                    {report.ai_status === 'pending' || report.ai_status === 'processing' ? (
                      <div className="space-y-4 animate-shimmer p-4 border border-gray-100 rounded-2xl">
                        <div className="h-4 bg-gray-200 rounded-sm w-3/4"></div>
                        <div className="h-20 bg-gray-200 rounded-sm"></div>
                        <div className="h-4 bg-gray-200 rounded-sm w-1/2"></div>
                      </div>
                    ) : report.ai_status === 'failed' ? (
                      <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center space-y-3">
                        <AlertTriangle className="h-8 w-8 text-warning-custom mx-auto" />
                        <h4 className="font-bold text-amber-900 font-display">AI Summary Unavailable</h4>
                        <p className="text-xs text-amber-700">
                          The system was unable to parse this report to generate summary insights.
                        </p>
                      </div>
                    ) : report.ai_summary ? (
                      <div className="space-y-6">
                        {/* Score Box */}
                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center justify-between">
                          <span className="text-sm font-semibold text-indigo-900 flex items-center">
                            <Award className="h-5 w-5 mr-1.5 text-accent" /> AI Completeness Score
                          </span>
                          <span className="text-lg font-bold text-indigo-900 font-mono">
                            {report.ai_summary.completeness_score} / 5
                          </span>
                        </div>

                        {/* Critical Alerts Banner */}
                        {report.ai_summary.critical_alerts && report.ai_summary.critical_alerts.length > 0 && (
                          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 space-y-2">
                            <h4 className="text-sm font-bold flex items-center">
                              <AlertTriangle className="h-4 w-4 mr-1 text-danger-custom" /> Critical Alerts
                            </h4>
                            <ul className="list-disc pl-4 text-xs space-y-1">
                              {report.ai_summary.critical_alerts.map((a: string, i: number) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Summary paragraph */}
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Executive Summary</h4>
                          <p className="text-sm text-primary-text font-sans leading-relaxed">
                            {report.ai_summary.summary}
                          </p>
                        </div>

                        {/* Breakthroughs */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Breakthroughs & Wins</h4>
                          <ul className="space-y-1 text-sm font-sans text-primary-text">
                            {(report.ai_summary.breakthroughs || []).map((b: string, i: number) => (
                              <li key={i} className="flex items-start">
                                <span className="text-green-500 mr-2">•</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Issues */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Challenges & Issues</h4>
                          <ul className="space-y-1 text-sm font-sans text-primary-text">
                            {(report.ai_summary.issues || []).map((is: string, i: number) => (
                              <li key={i} className="flex items-start">
                                <span className="text-amber-500 mr-2">•</span>
                                <span>{is}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-sm text-gray-400 py-6">No summary loaded.</div>
                    )}
                  </div>
                )}

                {/* TAB 3: ADMIN COMMENTS */}
                {activeTab === 'comments' && (
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Feedback History</h3>
                    
                    {comments.length === 0 ? (
                      <div className="text-center text-sm text-gray-400 py-8 flex flex-col items-center">
                        <MessageSquare className="h-8 w-8 mb-2" />
                        <span>No administrator feedback left on this version yet.</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {comments.map((comment) => (
                          <div key={comment.id} className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex items-start space-x-3 animate-fade-in">
                            <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-primary text-xs shrink-0">
                              {comment.profiles?.full_name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-primary-text">{comment.profiles?.full_name || 'Administrator'}</span>
                                <span className="text-xxs text-gray-400">{new Date(comment.created_at).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1 font-sans">{comment.comment}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {user?.role === 'admin' && (
                      <form onSubmit={handlePostComment} className="border-t border-gray-100 pt-4 mt-4 space-y-3">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Leave Feedback</label>
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          required
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-primary-text"
                          placeholder="Type feedback comment to Coordinator..."
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isPostingComment || !newComment.trim()}
                            className="bg-primary text-white font-semibold py-2 px-4 rounded-xl text-xs hover:bg-indigo-800 disabled:opacity-50 cursor-pointer flex items-center"
                          >
                            {isPostingComment && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                            Post Feedback
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

              </div>

              {/* Version History Accordion / List (Visible on all tabs) */}
              {versions.length > 1 && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                  <div className="flex items-center space-x-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    <History className="h-4 w-4" />
                    <span>Submission Revisions ({versions.length})</span>
                  </div>
                  <div className="flex space-x-2 overflow-x-auto pb-1">
                    {versions.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleVersionClick(v.id)}
                        className={`text-xs px-3.5 py-2 rounded-xl border font-semibold shrink-0 cursor-pointer transition-all ${
                          selectedVersionId === v.id
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        Version {v.version} {v.is_late ? '(Late)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

      </div>
    </div>
  );
};
export default ReportSlideOver;
