import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { 
  Users as UsersIcon, 
  Trash2, 
  UserCheck, 
  UserX, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Loader2,
  X,
  AlertTriangle,
  MoreVertical
} from 'lucide-react';

interface UserItem {
  id: string;
  full_name: string | null;
  email: string;
  role: 'admin' | 'unit_head';
  is_super_admin: boolean;
  unit_id: string | null;
  account_status: 'pending' | 'active' | 'suspended';
  units: { name: string } | null;
}

export const Users: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Demote modal states
  const [showDemoteModal, setShowDemoteModal] = useState(false);
  const [demoteUserId, setDemoteUserId] = useState<string | null>(null);
  const [demoteUnitId, setDemoteUnitId] = useState('');
  const [isDemoting, setIsDemoting] = useState(false);

  // Mobile actions sheet state
  const [selectedUserForActions, setSelectedUserForActions] = useState<UserItem | null>(null);

  const loadUsersAndUnits = async () => {
    setIsLoading(true);
    try {
      const usersData = await apiGet<UserItem[]>('/users');
      setUsers(usersData);

      // Load units for demotion mapping
      const { data } = await supabase
        .from('units')
        .select('id, name')
        .neq('status', 'deactivated');
      setUnits(data || []);
    } catch (err) {
      console.error('Failed to load user management data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsersAndUnits();
  }, []);

  const handleSuspend = async (userId: string) => {
    try {
      await apiPost(`/users/${userId}/suspend`);
      await loadUsersAndUnits();
    } catch (err: any) {
      alert(err.message || 'Failed to suspend user.');
    }
  };

  const handleUnsuspend = async (userId: string) => {
    try {
      await apiPost(`/users/${userId}/unsuspend`);
      await loadUsersAndUnits();
    } catch (err: any) {
      alert(err.message || 'Failed to unsuspend user.');
    }
  };

  const handlePromote = async (userId: string) => {
    if (!window.confirm('Are you sure you want to promote this user to Admin? They will lose unit coordinator binding.')) return;
    try {
      await apiPost(`/users/${userId}/promote`);
      await loadUsersAndUnits();
    } catch (err: any) {
      alert(err.message || 'Failed to promote user.');
    }
  };

  const handleDemoteClick = (userId: string) => {
    setDemoteUserId(userId);
    setDemoteUnitId('');
    setShowDemoteModal(true);
  };

  const handleDemoteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoteUserId || !demoteUnitId) return;

    setIsDemoting(true);
    try {
      await apiPost(`/users/${demoteUserId}/demote`, { unitId: demoteUnitId });
      setShowDemoteModal(false);
      await loadUsersAndUnits();
    } catch (err: any) {
      alert(err.message || 'Failed to demote user. Ensure the selected unit does not already have a head.');
    } finally {
      setIsDemoting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('⚠️ WARNING: This will permanently delete this user account. This action cannot be undone. Do you wish to proceed?')) return;
    try {
      await apiDelete(`/users/${userId}`);
      await loadUsersAndUnits();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  // Get units that don't already have an assigned unit head
  const getAvailableUnits = () => {
    const assignedUnitIds = users.filter(u => u.role === 'unit_head' && u.unit_id).map(u => u.unit_id);
    return units.filter(un => !assignedUnitIds.includes(un.id));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
        <h1 className="text-3xl font-bold font-display text-primary-text mb-1 flex items-center">
          <UsersIcon className="h-8 w-8 text-primary mr-2" /> Platform User Directory
        </h1>
        <p className="text-sm text-gray-500 font-sans">
          Manage system administrators, coordinate unit heads, promote/demote accounts, and handle suspensions.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-xs text-gray-500 mt-2">Loading user profiles...</span>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-indigo-950 text-indigo-100 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Department Unit</th>
                  <th className="py-4 px-6">Account Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {users.map((profile) => {
                  const isSelf = currentUser?.id === profile.id;
                  const isSuper = profile.is_super_admin;
                  const statusColors = {
                    active: 'bg-green-50 text-green-700 border-green-200',
                    pending: 'bg-amber-50 text-amber-700 border-amber-200',
                    suspended: 'bg-red-50 text-red-700 border-red-200'
                  };

                  return (
                    <tr key={profile.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-primary-text">
                        {profile.full_name || 'Pending Onboarding'}
                        {isSelf && <span className="text-xxs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 ml-2">You</span>}
                        {isSuper && <span className="text-xxs font-bold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-200 ml-2">Super Admin</span>}
                      </td>
                      <td className="py-4 px-6 text-gray-500">{profile.email}</td>
                      <td className="py-4 px-6 uppercase text-xxs font-bold tracking-wider">
                        {profile.role === 'admin' ? 'Admin' : 'Unit Leader'}
                      </td>
                      <td className="py-4 px-6 text-gray-400">
                        {profile.role === 'admin' ? '—' : (profile.units?.name || 'Unassigned')}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-xxs font-bold px-2 py-0.5 rounded-full border uppercase ${statusColors[profile.account_status]}`}>
                          {profile.account_status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-1">
                        {/* Disable controls if row belongs to self or Super Admin */}
                        {!isSelf && !isSuper && (
                          <>
                            {/* Suspend/Unsuspend Toggle */}
                            {profile.account_status === 'suspended' ? (
                              <button
                                onClick={() => handleUnsuspend(profile.id)}
                                className="px-2.5 py-1.5 hover:bg-green-50 text-green-700 rounded-xl text-xxs font-semibold border border-transparent hover:border-green-200 transition-all cursor-pointer"
                                title="Unsuspend Account"
                              >
                                <UserCheck className="h-3.5 w-3.5 inline mr-1" /> Activate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSuspend(profile.id)}
                                className="px-2.5 py-1.5 hover:bg-red-50/50 text-red-600 rounded-xl text-xxs font-semibold border border-transparent hover:border-red-200 transition-all cursor-pointer"
                                title="Suspend Account"
                              >
                                <UserX className="h-3.5 w-3.5 inline mr-1" /> Suspend
                              </button>
                            )}

                            {/* Super Admin Promote / Demote triggers */}
                            {currentUser?.is_super_admin && (
                              <>
                                {profile.role === 'unit_head' ? (
                                  <button
                                    onClick={() => handlePromote(profile.id)}
                                    className="px-2.5 py-1.5 hover:bg-indigo-50 text-primary rounded-xl text-xxs font-semibold border border-transparent hover:border-indigo-200 transition-all cursor-pointer"
                                    title="Promote to Admin"
                                  >
                                    <ArrowUpCircle className="h-3.5 w-3.5 inline mr-1" /> Promote
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDemoteClick(profile.id)}
                                    className="px-2.5 py-1.5 hover:bg-orange-50 text-orange-700 rounded-xl text-xxs font-semibold border border-transparent hover:border-orange-200 transition-all cursor-pointer"
                                    title="Demote to Coordinator"
                                  >
                                    <ArrowDownCircle className="h-3.5 w-3.5 inline mr-1" /> Demote
                                  </button>
                                )}

                                {/* Delete user account */}
                                <button
                                  onClick={() => handleDeleteUser(profile.id)}
                                  className="px-2.5 py-1.5 hover:bg-red-50 text-red-500 rounded-xl text-xxs font-semibold border border-transparent hover:border-red-100 transition-all cursor-pointer"
                                  title="Delete User Account"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {(isSelf || isSuper) && <span className="text-xxs text-gray-300 italic">No actions allowed</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="block lg:hidden p-4 space-y-4">
            {users.map((profile) => {
              const isSelf = currentUser?.id === profile.id;
              const isSuper = profile.is_super_admin;
              const statusColors = {
                active: 'bg-green-50 text-green-700 border-green-200',
                pending: 'bg-amber-50 text-amber-700 border-amber-200',
                suspended: 'bg-red-50 text-red-700 border-red-200'
              };

              return (
                <div key={profile.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col space-y-3 relative shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-6">
                      <h4 className="font-bold text-primary-text flex flex-wrap items-center gap-1.5 text-sm">
                        {profile.full_name || 'Pending Onboarding'}
                        {isSelf && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-100 shrink-0">You</span>}
                        {isSuper && <span className="text-[10px] font-bold text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded-full border border-yellow-200 shrink-0">Super Admin</span>}
                      </h4>
                      <p className="text-xs text-gray-500 font-sans mt-0.5 truncate">{profile.email}</p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusColors[profile.account_status]}`}>
                        {profile.account_status}
                      </span>
                      {!isSelf && !isSuper && (
                        <button
                          onClick={() => setSelectedUserForActions(profile)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 cursor-pointer shrink-0"
                          title="Open Actions Menu"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-50">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Role</span>
                      <span className="text-primary-text font-medium uppercase text-[11px]">{profile.role === 'admin' ? 'Admin' : 'Unit Leader'}</span>
                    </div>
                    {profile.role !== 'admin' && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Department</span>
                        <span className="text-gray-600 font-medium">{profile.units?.name || 'Unassigned'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {users.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">No users found.</p>
            )}
          </div>
        </div>
      )}

      {/* MOBILE ACTIONS BOTTOM SHEET */}
      {selectedUserForActions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={() => setSelectedUserForActions(null)} />
          <div className="bg-white w-full rounded-t-3xl border-t border-gray-200 p-6 relative z-10 shadow-2xl animate-slide-up-bottom pb-safe max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="min-w-0">
                <h4 className="font-bold text-primary-text truncate text-base">{selectedUserForActions.full_name || 'Pending Onboarding'}</h4>
                <p className="text-xs text-gray-500 truncate font-sans">{selectedUserForActions.email}</p>
              </div>
              <button onClick={() => setSelectedUserForActions(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedUserForActions.account_status === 'suspended' ? (
                <button
                  onClick={() => {
                    handleUnsuspend(selectedUserForActions.id);
                    setSelectedUserForActions(null);
                  }}
                  className="w-full h-12 px-4 bg-green-50 text-green-700 rounded-xl text-sm font-semibold border border-green-200 hover:bg-green-100 cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserCheck className="h-4 w-4" /> Activate Account
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleSuspend(selectedUserForActions.id);
                    setSelectedUserForActions(null);
                  }}
                  className="w-full h-12 px-4 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-200 hover:bg-red-100 cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserX className="h-4 w-4" /> Suspend Account
                </button>
              )}

              {currentUser?.is_super_admin && (
                <>
                  {selectedUserForActions.role === 'unit_head' ? (
                    <button
                      onClick={() => {
                        handlePromote(selectedUserForActions.id);
                        setSelectedUserForActions(null);
                      }}
                      className="w-full h-12 px-4 bg-indigo-50 text-primary rounded-xl text-sm font-semibold border border-indigo-200 hover:bg-indigo-100 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ArrowUpCircle className="h-4 w-4" /> Promote to Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleDemoteClick(selectedUserForActions.id);
                        setSelectedUserForActions(null);
                      }}
                      className="w-full h-12 px-4 bg-orange-50 text-orange-700 rounded-xl text-sm font-semibold border border-orange-200 hover:bg-orange-100 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ArrowDownCircle className="h-4 w-4" /> Demote to Coordinator
                    </button>
                  )}

                  <button
                    onClick={() => {
                      handleDeleteUser(selectedUserForActions.id);
                      setSelectedUserForActions(null);
                    }}
                    className="w-full h-12 px-4 bg-red-100 text-red-700 rounded-xl text-sm font-semibold border border-red-200 hover:bg-red-200 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" /> Delete Account Permanently
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DEMOTE ADMIN MODAL / BOTTOM SHEET */}
      {showDemoteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-4 animate-fade-in">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={() => setShowDemoteModal(false)} />
          <div className="bg-white w-full rounded-t-3xl border-t border-gray-200 p-6 relative z-10 shadow-2xl animate-slide-up-bottom pb-safe max-h-[90vh] overflow-y-auto lg:max-w-sm lg:rounded-3xl lg:border lg:shadow-2xl lg:animate-scale-in space-y-4 lg:pb-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold font-display text-primary-text flex items-center">
                <ArrowDownCircle className="h-5 w-5 text-orange-600 mr-2" /> Demote Admin
              </h3>
              <button onClick={() => setShowDemoteModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDemoteConfirm} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 text-xxs text-amber-800 p-3 rounded-xl flex items-start space-x-2 leading-relaxed">
                <AlertTriangle className="h-4.5 w-4.5 text-warning-custom shrink-0 mt-0.5" />
                <p>
                  This admin will be demoted back to a unit head. You must link them to an active, unassigned church department.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Select Department</label>
                <select
                  value={demoteUnitId}
                  onChange={(e) => setDemoteUnitId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-primary-text focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Choose Unit --</option>
                  {getAvailableUnits().map(un => (
                    <option key={un.id} value={un.id}>{un.name}</option>
                  ))}
                </select>
                {getAvailableUnits().length === 0 && (
                  <span className="text-xxs text-red-600 mt-1 block">
                    No unassigned departments available. Create a unit first.
                  </span>
                )}
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowDemoteModal(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDemoting || !demoteUnitId}
                  className="flex-1 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-indigo-800 transition-colors text-xs flex items-center justify-center cursor-pointer"
                >
                  {isDemoting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Confirm Demote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default Users;
