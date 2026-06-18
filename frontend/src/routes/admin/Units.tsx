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
      await apiPost('/units', {
        name,
        description,
        unitHeadEmail
      });

      // Reset form states & reload
      setName('');
      setDescription('');
      setUnitHeadEmail('');
      setIsOpen(false);
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
          className="flex items-center text-xs font-bold text-white bg-primary hover:bg-indigo-800 py-3 px-5 rounded-2xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Create New Department
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
        {/* Search */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search by department name or coordinator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          />
        </div>
        
        {/* Filter status */}
        <div className="flex items-center space-x-2 shrink-0">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status: </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl text-sm px-4 py-2.5 text-primary-text focus:outline-none focus:ring-2 focus:ring-primary"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xxs hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between h-52 hover:scale-98"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold font-display text-primary-text leading-tight truncate max-w-[70%]">
                      {unit.name}
                    </h3>
                    <span className={`text-xxs font-bold px-2 py-0.5 rounded-full border uppercase ${statusConfig[unit.status]}`}>
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
                    <span className={`font-semibold text-xxs flex items-center ${reportConfigs[unit.reportStatus].color}`}>
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

      {/* CREATE UNIT MODAL */}
      {isOpen && (
        <div className="fixed inset-0 overflow-hidden z-50 animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsOpen(false)} />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white flex flex-col h-full shadow-2xl border-l border-gray-100 animate-slide-in">
              <div className="bg-indigo-950 p-6 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold font-display leading-tight">Create Department</h3>
                  <p className="text-xs text-indigo-300 mt-1 font-sans">
                    Setup a new church unit and provision credentials.
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-indigo-200 hover:text-white p-2 rounded-full hover:bg-indigo-900/50 transition-all cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="E.g., Choir, Ushers, Youth"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-primary-text mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="leader@graceplace.org"
                  />
                  <p className="text-xxs text-gray-400 mt-1.5 font-sans leading-relaxed">
                    <strong>Note:</strong> Generating this department will atomically create a Supabase Auth user account with a temporary password and dispatch a welcome credentials email.
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-6 flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-indigo-800 transition-colors text-sm flex items-center justify-center cursor-pointer"
                  >
                    {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    Create Department
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default Units;
