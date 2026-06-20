import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  LayoutDashboard, 
  Layers, 
  CalendarDays, 
  BrainCircuit, 
  Trophy, 
  Users, 
  Settings, 
  LogOut 
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const churchName = import.meta.env.VITE_CHURCH_NAME || 'Grace Place';

  const menuItems = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard, end: true },
    { name: 'Units', path: '/admin/units', icon: Layers },
    { name: 'Monthly Reports', path: '/admin/monthly', icon: CalendarDays },
    { name: 'Summaries & Insights', path: '/admin/summaries', icon: BrainCircuit },
    { name: 'Leaderboard', path: '/admin/leaderboard', icon: Trophy },
    { name: 'User Management', path: '/admin/users', icon: Users },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-indigo-950 text-indigo-100 flex flex-col min-h-screen border-r border-indigo-900 hidden lg:flex shrink-0">
      {/* Brand Logo Header */}
      <div className="p-6 border-b border-indigo-900 bg-indigo-950">
        <h1 className="text-2xl font-bold font-display text-white truncate">{churchName}</h1>
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mt-1 block">
          Admin Portal
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-accent text-white shadow-md'
                  : 'text-indigo-200 hover:bg-indigo-900 hover:text-white'
              }`
            }
          >
            <item.icon className="h-5 w-5 shrink-0 group-hover:scale-105 transition-transform" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Current User Info & Logout Button */}
      <div className="p-4 border-t border-indigo-900 bg-indigo-950/50">
        <div className="flex items-center space-x-3 mb-3 px-2">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name || 'Profile'} className="h-9 w-9 rounded-full object-cover border border-indigo-800" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center font-bold text-white text-sm">
              {(user?.full_name || 'A').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {user?.full_name || 'Administrator'}
            </p>
            <p className="text-xs text-indigo-400 truncate leading-none mt-1">
              {user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-indigo-300 hover:bg-red-950/30 hover:text-red-400 transition-colors cursor-pointer"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
export default AdminSidebar;
