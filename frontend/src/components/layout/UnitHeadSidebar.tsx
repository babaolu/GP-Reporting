import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLogout } from '../../hooks/useLogout';
import { useChurchName } from '../../hooks/useChurchName';
import { 
  LayoutDashboard, 
  FileInput, 
  History, 
  Settings, 
  LogOut,
  Loader2
} from 'lucide-react';

export const UnitHeadSidebar: React.FC = () => {
  const { user } = useAuth();
  const { logout, isLoggingOut } = useLogout();
  const churchName = useChurchName();

  const menuItems = [
    { name: 'Overview', path: '/unit-head', icon: LayoutDashboard, end: true },
    { name: 'Submit Report', path: '/unit-head/report', icon: FileInput },
    { name: 'Report History', path: '/unit-head/history', icon: History },
    { name: 'Settings', path: '/unit-head/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-indigo-950 text-indigo-100 flex flex-col min-h-screen border-r border-indigo-900 hidden lg:flex shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-indigo-900 bg-indigo-950">
        <h1 className="text-2xl font-bold font-display text-white truncate">{churchName}</h1>
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mt-1 block">
          Unit Leader Portal
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

      {/* User Card */}
      <div className="p-4 border-t border-indigo-900 bg-indigo-950/50 space-y-4">
        {/* User Identity Block */}
        <div className="px-2 text-sm text-gray-500">
          <p className="text-gray-700 font-medium truncate">
            {user?.full_name || 'Unit Head'}
          </p>
          <p className="text-xs truncate mt-0.5">
            {user?.email}
          </p>
        </div>

        <button
          onClick={logout}
          disabled={isLoggingOut}
          className="w-full flex items-center space-x-3 px-2 py-2 text-sm font-medium text-indigo-300 hover:text-[#DC2626] transition-colors duration-150 cursor-pointer disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          ) : (
            <LogOut className="h-5 w-5 shrink-0" />
          )}
          <span>{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
        </button>
      </div>
    </aside>
  );
};
export default UnitHeadSidebar;
