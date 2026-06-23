import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/api';
import { getCurrentReportingMonth } from '../../lib/date-helpers';
import { 
  Plus, 
  Search, 
  Layers, 
  User, 
  CheckCircle2,
  Snowflake, 
  X, 
  Loader2, 
  AlertTriangle 
} from 'lucide-react';

interface UnitItem {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'frozen' | 'deactivated';
  headName: string | null;
  headEmail: string | null;
  reportStatus: 'submitted' | 'late' | 'pending';
}

export const Units: React.FC = () => {
  const navigate = useNavigate();
  const currentMonthStr = getCurrentReportingMonth();

  const [units, setUnits] = useState<UnitItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal creation states
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitHeadEmail, setUnitHeadEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ name: string; email: string; tempPassword?: string } | null>(null);

  const handleCloseModal = () => {
    setIsOpen(false);
    setSuccessData(null);
    setModalError(null);
  };

  const loadUnits = async () => {
    setIsLoading(true);
    try {
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .order('name', { ascending: true });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'unit_head');

      const { data: reports } = await supabase
        .from('reports')
        .select('unit_id, is_late')
        .eq('month', currentMonthStr)
        .eq('is_latest', true);

      if (unitsData) {
        const headMap = new Map<string, { name: string; email: string }>();
        if (profiles) {
          profiles.forEach(p => {
            if (p.unit_id) headMap.set(p.unit_id, { name: p.full_name || 'Unit Head', email: p.email });
          });
        }

        const reportMap = new Map<string, boolean>();
        if (reports) {
          reports.forEach(r => {
            reportMap.set(r.unit_id, r.is_late);
          });
        }

        const compiled: UnitItem[] = unitsData.map(u => {
          const head = headMap.get(u.id);
          const isLate = reportMap.get(u.id);
          
          let reportStatus: 'submitted' | 'late' | 'pending' = 'pending';
          if (isLate !== undefined) {
            reportStatus = isLate ? 'late' : 'submitted';
          }

          return {
            id: u.id,
            name: u.name,
            description: u.description,
            status: u.status as any,
            headName: head?.name || null,
            headEmail: head?.email || null,
            reportStatus
          };
        });

        setUnits(compiled);
      }
    } catch (err) {
      console.error('Failed to load units list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !unitHeadEmail) {
      setModalError('Unit Name and Unit Head Email are required.');
      return;
    }

    setModalError(null);
    setIsCreating(true);

    try {
      const res = await apiPost<any>('/units', {
        name,
        description,
        unitHeadEmail
      });

      setSuccessData({
        name,
        email: unitHeadEmail,
        tempPassword: res.tempPassword
      });

      // Reset form states & reload
      setName('');
      setDescription('');
      setUnitHeadEmail('');
      await loadUnits();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create unit.');
    } finally {
      setIsCreating(false);
    }
  };

  // Filters logic
  const filteredUnits = units.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (u.headName && u.headName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && u.status === statusFilter;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Panel */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-primary-text mb-1">
            Department Units
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Manage church departments, configure unit heads, and review status.
          </p>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-28 right-4 z-40 h-14 w-14 rounded-full shadow-lg bg-primary text-white flex items-center justify-center lg:static lg:h-auto lg:w-auto lg:rounded-2xl lg:shadow-md lg:shadow-indigo-100 lg:px-5 lg:py-3 hover:bg-indigo-800 transition-all cursor-pointer shrink-0"
        >
          <Plus className="h-6 w-6 lg:h-4 lg:w-4 lg:mr-1.5 shrink-0" />
          <span className="hidden lg:inline">Create New Department</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Search */}
        <div className="flex-1 relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search by department name or coordinator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-base text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          />
        </div>
        
        {/* Filter status */}
        <div className="flex items-center justify-between lg:justify-start space-x-2 w-full lg:w-auto shrink-0">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status: </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl text-base px-4 py-2.5 text-primary-text focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-auto"
          >
            <option value="all">All Departments</option>
            <option value="active">Active</option>
            <option value="frozen">Frozen</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-xs text-gray-500 mt-2">Loading departments...</span>
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 shadow-sm flex flex-col items-center">
          <Layers className="h-12 w-12 mb-3" />
          <h4 className="text-base font-bold font-display text-primary-text">No departments found</h4>
          <p className="text-xs text-gray-500 mt-1">Try clearing filters or search keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUnits.map((unit) => {
            const statusConfig = {
              active: 'bg-green-50 text-green-700 border-green-200',
              frozen: 'bg-gray-100 text-gray-600 border-gray-200',
              deactivated: 'bg-red-50 text-red-700 border-red-200'
            };

            const reportConfigs = {
              submitted: { text: 'Submitted On Time', color: 'text-green-600' },
              late: { text: 'Late Submission', color: 'text-amber-500' },
              pending: { text: 'Pending Submission', color: 'text-gray-400' }
            };

            return (
              <div
                key={unit.id}
                onClick={() => navigate(`/admin/units/${unit.id}`)}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xxs hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[13rem] hover:scale-98"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-1.5">
                    <h3 className="text-base sm:text-lg font-bold font-display text-primary-text leading-tight truncate max-w-[70%]">
                      {unit.name}
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase shrink-0 ${statusConfig[unit.status]}`}>
                      {unit.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                    {unit.description || 'No department description provided.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-50 space-y-2">
                  <div className="flex items-center text-xs text-gray-600">
                    <User className="h-3.5 w-3.5 mr-1.5 text-gray-400 shrink-0" />
                    <span className="truncate">Leader: <strong className="text-primary-text">{unit.headName || 'Not Assigned'}</strong></span>
                  </div>
                  
                  <div className="flex items-center text-xs justify-between">
                    <span className="text-gray-400">Monthly Submission:</span>
                    <span className={`font-semibold text-xxs flex items-center shrink-0 ${reportConfigs[unit.reportStatus].color}`}>
                      {unit.status === 'frozen' ? (
                        <span className="flex items-center"><Snowflake className="h-3 w-3 mr-1" /> Awaiting Head</span>
                      ) : (
                        reportConfigs[unit.reportStatus].text
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 overflow-hidden z-50 animate-fade-in flex flex-col justify-end lg:justify-start">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={handleCloseModal} />
          
          <div className="relative w-full bg-white flex flex-col h-[90vh] rounded-t-3xl shadow-2xl border-t border-gray-250 animate-slide-up-bottom lg:h-full lg:w-screen lg:max-w-md lg:rounded-none lg:border-t-0 lg:border-l lg:border-gray-100 lg:animate-slide-in lg:self-end">
            {/* Drag Handle Bar on Mobile */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-2.5 shrink-0 lg:hidden" />

            <div className="bg-indigo-950 p-5 mt-2 lg:mt-0 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg lg:text-xl font-bold font-display leading-tight">
                  {successData ? 'Credentials Provisioned' : 'Create Department'}
                </h3>
                <p className="text-xs text-indigo-300 mt-1 font-sans">
                  {successData ? 'Copy the temporary credentials below.' : 'Setup a new church unit and provision credentials.'}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-indigo-200 hover:text-white p-2.5 rounded-full hover:bg-indigo-900/50 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {successData ? (
              <div className="flex-1 p-6 space-y-6 overflow-y-auto flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-start space-x-3 text-xs text-green-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
                    <div>
                      <strong className="block text-green-800 font-semibold mb-0.5">Creation Success!</strong>
                      Department unit has been created and an authentication account was successfully provisioned.
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-4 font-sans text-xs">
                    <div>
                      <span className="text-gray-400 font-semibold block uppercase tracking-wider mb-1">Department</span>
                      <strong className="text-primary-text text-sm">{successData.name}</strong>
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
                    Note: A welcome email containing these credentials was sent to the coordinator. The password must be reset upon their first login.
                  </p>
                </div>

                <button
                  onClick={handleCloseModal}
                  className="w-full py-3 bg-primary hover:bg-indigo-800 text-white font-semibold rounded-xl text-sm transition-all shadow-md cursor-pointer mt-8 min-h-[44px]"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUnit} className="flex-1 p-6 space-y-6 overflow-y-auto">
                {modalError && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start space-x-2.5 text-xs text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-primary-text mb-1">Department Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    placeholder="E.g., Choir, Ushers, Youth"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-primary-text mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary h-24"
                    placeholder="Provide a brief description of the department's mandate..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-primary-text mb-1">Unit Head Email</label>
                  <input
                    type="email"
                    required
                    value={unitHeadEmail}
                    onChange={(e) => setUnitHeadEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    placeholder="leader@graceplace.org"
                  />
                  <p className="text-xxs text-gray-400 mt-1.5 font-sans leading-relaxed">
                    <strong>Note:</strong> Generating this department will atomically create a Supabase Auth user account with a temporary password and dispatch a welcome credentials email.
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-6 flex space-x-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-3 border border-gray-300 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm cursor-pointer min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-indigo-800 transition-colors text-sm flex items-center justify-center cursor-pointer min-h-[44px]"
                  >
                    {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    Create Department
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
export default Units;
