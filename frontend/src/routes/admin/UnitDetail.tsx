import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../lib/api';
import ReportTimeline from '../../components/timeline/ReportTimeline';
import { 
  ArrowLeft, 
  Snowflake, 
  CheckCircle, 
  AlertTriangle, 
  UserMinus, 
  BrainCircuit, 
  Trash2,
  Loader2,
  TrendingUp,
  X
} from 'lucide-react';

interface UnitDetailsData {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'frozen' | 'deactivated';
  created_at: string;
  unitHead: {
    id: string;
    full_name: string | null;
    email: string;
    phone_number: string | null;
    telegram_linked: boolean;
    account_status: string;
  } | null;
}

export const UnitDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [unit, setUnit] = useState<UnitDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal controls
  const [showChangeHead, setShowChangeHead] = useState(false);
  const [newHeadEmail, setNewHeadEmail] = useState('');
  const [isUpdatingHead, setIsUpdatingHead] = useState(false);
  const [successData, setSuccessData] = useState<{ email: string; tempPassword?: string } | null>(null);

  const handleCloseChangeHead = () => {
    setShowChangeHead(false);
    setSuccessData(null);
    setNewHeadEmail('');
  };

  const [showDeactivate, setShowDeactivate] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Trend analysis states
  const [trendData, setTrendData] = useState<any | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  const fetchUnitDetails = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<UnitDetailsData>(`/units/${id}`);
      setUnit(data);
    } catch (err: any) {
      console.error('Failed to load unit details:', err);
      setError(err.message || 'Failed to load department details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnitDetails();
  }, [id]);

  const handleChangeUnitHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeadEmail || !id) return;

    setIsUpdatingHead(true);
    try {
      const res = await apiPost<any>(`/units/${id}/change-head`, { newEmail: newHeadEmail });
      setSuccessData({
        email: newHeadEmail,
        tempPassword: res.tempPassword
      });
      await fetchUnitDetails();
      setTrendData(null); // Clear trend data as unit head changed
    } catch (err: any) {
      alert(err.message || 'Failed to change unit head.');
    } finally {
      setIsUpdatingHead(false);
    }
  };

  const handleDeactivateUnit = async () => {
    if (!id) return;
    setIsDeactivating(true);
    try {
      await apiPost(`/units/${id}/deactivate`);
      setShowDeactivate(false);
      await fetchUnitDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate unit.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleLoadTrendAnalysis = async () => {
    if (!id) return;
    setLoadingTrend(true);
    setTrendError(null);
    try {
      const data = await apiPost<any>('/ai/trend', { unitId: id });
      setTrendData(data);
    } catch (err: any) {
      console.error('Trend analysis failed:', err);
      setTrendError(err.message || 'No reports with completed AI analysis found to analyze trends.');
    } finally {
      setLoadingTrend(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-bg">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/admin/units')} className="flex items-center text-sm text-gray-500 hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Departments
        </button>
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-center text-red-700">
          {error || 'Unit details could not be found.'}
        </div>
      </div>
    );
  }

  const statusConfigs = {
    active: { text: 'Active', bg: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
    frozen: { text: 'Frozen', bg: 'bg-gray-100 text-gray-600 border-gray-200', icon: Snowflake },
    deactivated: { text: 'Deactivated', bg: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle }
  };

  const currentStatus = statusConfigs[unit.status];
  const StatusIcon = currentStatus.icon;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Navigation */}
      <div className="flex flex-col space-y-4">
        <button
          onClick={() => navigate('/admin/units')}
          className="flex items-center text-sm font-semibold text-gray-500 hover:text-primary transition-colors cursor-pointer w-fit"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Departments
        </button>

        <div className="bg-white p-4 lg:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl lg:text-3xl font-bold font-display text-primary-text">{unit.name}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center w-fit uppercase ${currentStatus.bg}`}>
                <StatusIcon className="h-3 w-3 mr-0.5" /> {currentStatus.text}
              </span>
            </div>
            <p className="text-xs lg:text-sm text-gray-500 mt-2 font-sans max-w-xl leading-relaxed">
              {unit.description || 'No department description provided.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
            <button
              onClick={() => setShowChangeHead(true)}
              className="w-full lg:w-auto px-4 py-3 bg-indigo-50 border border-indigo-200 text-primary hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center min-h-[44px]"
            >
              <UserMinus className="h-4 w-4 mr-1.5 shrink-0" /> Change Unit Head
            </button>
            {unit.status !== 'deactivated' && (
              <button
                onClick={() => setShowDeactivate(true)}
                className="w-full lg:w-auto px-4 py-3 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center min-h-[44px]"
              >
                <Trash2 className="h-4 w-4 mr-1.5 shrink-0" /> Deactivate Unit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Unit Coordinator Card & Trend Analysis (Left column) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Coordinator Card */}
          <div className="bg-white p-5 lg:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Unit Coordinator</h3>
            
            {unit.unitHead ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center space-y-2 lg:flex-row lg:items-start lg:text-left lg:space-y-0 lg:space-x-3">
                  <div className="h-12 w-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center font-bold text-primary text-base lg:h-10 lg:w-10 lg:text-sm shrink-0">
                    {unit.unitHead.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary-text">{unit.unitHead.full_name || 'Awaiting Profile Setup'}</h4>
                    <span className="text-xxs text-gray-400">Account status: {unit.unitHead.account_status}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-2 pt-3 border-t border-gray-50 lg:border-t-0 lg:pt-0 font-sans flex flex-col items-center lg:items-start text-center lg:text-left">
                  <div><strong>Email:</strong> {unit.unitHead.email}</div>
                  <div><strong>Phone:</strong> {unit.unitHead.phone_number || 'Not Provided'}</div>
                  <div className="flex flex-col min-[350px]:flex-row items-center gap-1.5 mt-1">
                    <strong className="text-gray-400">Telegram Bot:</strong>
                    {unit.unitHead.telegram_linked ? (
                      <span className="text-xxs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">Linked</span>
                    ) : (
                      <span className="text-xxs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">Not Linked</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-400 space-y-2">
                <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
                <p>No Unit Head currently assigned to this unit.</p>
              </div>
            )}
          </div>

          {/* AI Trend Analysis Card */}
          <div className="bg-white p-5 lg:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                <TrendingUp className="h-4.5 w-4.5 mr-1.5 text-primary" /> AI Trend Analysis
              </h3>
            </div>

            {!trendData ? (
              <div className="text-center py-6 space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed font-sans">
                  Generate chronological department tracking reports spanning the last 6 months.
                </p>
                {trendError && (
                  <div className="text-xxs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    {trendError}
                  </div>
                )}
                <button
                  onClick={handleLoadTrendAnalysis}
                  disabled={loadingTrend}
                  className="w-full py-3 bg-primary text-white hover:bg-indigo-800 disabled:opacity-50 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center min-h-[44px]"
                >
                  {loadingTrend ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <BrainCircuit className="h-4 w-4 mr-1.5 text-accent" />
                  )}
                  View Trend Analysis
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {/* Momentum Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">Momentum Indicator:</span>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                    trendData.momentum === 'positive' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : trendData.momentum === 'concerning'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {trendData.momentum}
                  </span>
                </div>

                {/* Narrative */}
                <div className="space-y-1">
                  <span className="text-xxs font-bold text-gray-400 uppercase tracking-wider block">Performance Trajectory</span>
                  <p className="text-xs text-primary-text font-sans leading-relaxed text-justify">
                    {trendData.trend_narrative}
                  </p>
                </div>

                {/* Persisting Issues */}
                {trendData.persisting_issues?.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-50">
                    <span className="text-xxs font-bold text-red-600 uppercase tracking-wider block">Persisting Issues</span>
                    <ul className="text-xs text-primary-text font-sans list-disc pl-4 space-y-1">
                      {trendData.persisting_issues.map((issue: string, i: number) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Resolved Issues */}
                {trendData.resolved_issues?.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-50">
                    <span className="text-xxs font-bold text-green-600 uppercase tracking-wider block">Resolved Issues</span>
                    <ul className="text-xs text-primary-text font-sans list-disc pl-4 space-y-1">
                      {trendData.resolved_issues.map((issue: string, i: number) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => setTrendData(null)}
                  className="w-full text-center text-xxs font-semibold text-gray-400 hover:text-primary transition-colors underline pt-2 block cursor-pointer min-h-[44px]"
                >
                  Reset Analysis Panel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Reports (Right columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 lg:p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-lg lg:text-xl font-bold font-display text-primary-text mb-6 border-b border-gray-50 pb-2">Department Timeline</h3>
            <ReportTimeline unitId={unit.id} />
          </div>
        </div>
      </div>

      {/* CHANGE UNIT HEAD MODAL */}
      {showChangeHead && (
        <div className="fixed inset-0 overflow-hidden z-50 animate-fade-in flex flex-col justify-end lg:justify-start">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={handleCloseChangeHead} />
          
          <div className="relative w-full bg-white flex flex-col h-[90vh] rounded-t-3xl shadow-2xl border-t border-gray-250 animate-slide-up-bottom lg:h-full lg:w-screen lg:max-w-md lg:rounded-none lg:border-t-0 lg:border-l lg:border-gray-100 lg:animate-slide-in lg:self-end">
            {/* Drag Handle Bar on Mobile */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-2.5 shrink-0 lg:hidden" />

            <div className="bg-indigo-950 p-5 mt-2 lg:mt-0 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg lg:text-xl font-bold font-display leading-tight">
                  {successData ? 'Credentials Provisioned' : 'Change Coordinator'}
                </h3>
                <p className="text-xs text-indigo-300 mt-1 font-sans">
                  {successData ? 'Copy the temporary credentials below.' : "Replace the department's unit head."}
                </p>
              </div>
              <button 
                onClick={handleCloseChangeHead} 
                className="text-indigo-200 hover:text-white p-2.5 rounded-full hover:bg-indigo-900/50 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {successData ? (
              <div className="flex-1 p-6 space-y-6 overflow-y-auto flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-start space-x-3 text-xs text-green-700">
                    <CheckCircle className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
                    <div>
                      <strong className="block text-green-800 font-semibold mb-0.5">Change Success!</strong>
                      The coordinator account has been swapped. The unit is currently frozen until they complete onboarding.
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-4 font-sans text-xs">
                    <div>
                      <span className="text-gray-400 font-semibold block uppercase tracking-wider mb-1">Department</span>
                      <strong className="text-primary-text text-sm">{unit?.name}</strong>
                    </div>
                    
                    <div>
                      <span className="text-gray-400 font-semibold block uppercase tracking-wider mb-1">Username / Email</span>
                      <strong className="text-primary-text text-sm">{successData.email}</strong>
                    </div>

                    <div>
                      <span className="text-gray-400 font-semibold block uppercase tracking-wider mb-1">Temporary Password</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-mono text-sm font-bold flex-1 select-all">
                          {successData.tempPassword}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            if (successData.tempPassword) {
                              navigator.clipboard.writeText(successData.tempPassword);
                              alert('Temporary password copied to clipboard!');
                            }
                          }}
                          className="bg-white hover:bg-gray-50 border border-gray-200 p-2.5 rounded-lg text-gray-500 hover:text-primary transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Copy Password"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" className="h-4 w-4">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-xxs text-gray-400 leading-normal">
                    Note: A welcome email containing these credentials was sent to the new coordinator. They will be prompted to reset their password upon first login.
                  </p>
                </div>

                <button
                  onClick={handleCloseChangeHead}
                  className="w-full py-3 bg-primary hover:bg-indigo-800 text-white font-semibold rounded-xl text-sm transition-all shadow-md cursor-pointer mt-8 min-h-[44px]"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangeUnitHead} className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start space-x-2 text-xs text-amber-800 leading-relaxed">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-warning-custom mt-0.5" />
                  <p>
                    <strong>Warning:</strong> This will permanently delete the previous coordinator's account. All unit history, submitted reports, AI summaries, and comment feeds are preserved. The unit will be <strong>frozen</strong> until the new head completes onboarding.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-primary-text mb-1">New Unit Head Email</label>
                  <input
                    type="email"
                    required
                    value={newHeadEmail}
                    onChange={(e) => setNewHeadEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    placeholder="newleader@graceplace.org"
                  />
                  <p className="text-xxs text-gray-400 mt-1.5 leading-relaxed">
                    This registers a new Supabase Auth user with a temporary password and sends a welcome onboarding email.
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-6 flex space-x-4">
                  <button
                    type="button"
                    onClick={handleCloseChangeHead}
                    className="flex-1 py-3 border border-gray-300 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm cursor-pointer min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingHead || !newHeadEmail}
                    className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-indigo-800 transition-colors text-sm flex items-center justify-center cursor-pointer min-h-[44px]"
                  >
                    {isUpdatingHead && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    Confirm Change
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DEACTIVATE UNIT CONFIRMATION MODAL */}
      {showDeactivate && (
        <div className="fixed inset-0 overflow-hidden z-50 animate-fade-in flex flex-col justify-end lg:justify-center lg:items-center p-0 lg:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowDeactivate(false)} />
          
          <div className="relative w-full lg:max-w-sm bg-white p-6 rounded-t-3xl lg:rounded-3xl shadow-2xl border-t border-gray-250 lg:border-t-0 border-gray-100 animate-slide-up-bottom lg:animate-scale-in z-10 text-center space-y-4">
            {/* Drag Handle Bar on Mobile */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-2 shrink-0 lg:hidden" />
            
            <div className="bg-red-50 text-danger-custom p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-red-100 shrink-0">
              <AlertTriangle className="h-8 w-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold font-display text-primary-text">Deactivate Department?</h3>
              <p className="text-xs text-gray-500 font-sans leading-relaxed">
                This will set <strong>{unit.name}</strong> to Deactivated status and suspend the unit head account. They will be immediately blocked from accessing the platform.
              </p>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowDeactivate(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateUnit}
                disabled={isDeactivating}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors text-sm flex items-center justify-center cursor-pointer min-h-[44px]"
              >
                {isDeactivating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default UnitDetail;
