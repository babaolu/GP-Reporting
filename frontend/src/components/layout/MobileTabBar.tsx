import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  LayoutDashboard, 
  Layers, 
  CalendarDays, 
  Settings, 
  FileInput, 
  History,
  BrainCircuit,
  Trophy,
  Users as UsersIcon,
  MoreHorizontal,
  X
} from 'lucide-react';

export const MobileTabBar: React.FC = () => {
  const { user } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  if (!user) return null;

  const adminTabs = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard, end: true },
    { name: 'Units', path: '/admin/units', icon: Layers, end: false },
    { name: 'Monthly', path: '/admin/monthly', icon: CalendarDays, end: false },
    { name: 'Summaries', path: '/admin/summaries', icon: BrainCircuit, end: false },
  ];

  const adminMoreTabs = [
    { name: 'Leaderboard', path: '/admin/leaderboard', icon: Trophy },
    { name: 'User Management', path: '/admin/users', icon: UsersIcon },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  const unitHeadTabs = [
    { name: 'Overview', path: '/unit-head', icon: LayoutDashboard, end: true },
    { name: 'Report', path: '/unit-head/report', icon: FileInput, end: false },
    { name: 'History', path: '/unit-head/history', icon: History, end: false },
    { name: 'Settings', path: '/unit-head/settings', icon: Settings, end: false },
  ];

  const isMoreActive = adminMoreTabs.some(
    tab => window.location.pathname.startsWith(tab.path)
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-indigo-950 text-indigo-200 border-t border-indigo-900 flex justify-around py-2 lg:hidden z-50 pb-safe shadow-lg">
        {user.role === 'admin' ? (
          <>
            {adminTabs.map((tab) => (
              <NavLink
                key={tab.name}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-col items-center space-y-1 py-1 px-2.5 rounded-xl text-xxs font-semibold transition-colors ${
                    isActive && !isMoreActive
                      ? 'text-white bg-indigo-900' 
                      : 'text-indigo-300 hover:text-white'
                  }`
                }
              >
                <tab.icon className="h-5 w-5 shrink-0" />
                <span className="hidden min-[375px]:block">{tab.name}</span>
              </NavLink>
            ))}

            <button
              onClick={() => setIsMoreOpen(true)}
              className={`flex flex-col items-center space-y-1 py-1 px-2.5 rounded-xl text-xxs font-semibold transition-colors cursor-pointer ${
                isMoreActive || isMoreOpen
                  ? 'text-white bg-indigo-900'
                  : 'text-indigo-300 hover:text-white'
              }`}
            >
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span className="hidden min-[375px]:block">More</span>
            </button>
          </>
        ) : (
          unitHeadTabs.map((tab) => (
            <NavLink
              key={tab.name}
              to={tab.path}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center space-y-1 py-1 px-2.5 rounded-xl text-xxs font-semibold transition-colors ${
                  isActive 
                    ? 'text-white bg-indigo-900' 
                    : 'text-indigo-300 hover:text-white'
                }`
              }
            >
              <tab.icon className="h-5 w-5 shrink-0" />
              <span className="hidden min-[375px]:block">{tab.name}</span>
            </NavLink>
          ))
        )}
      </nav>

      {/* Admin More Drawer Bottom Sheet */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex items-end animate-fade-in">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMoreOpen(false)}
          />
          
          {/* Bottom Sheet Drawer */}
          <div className="relative w-full bg-indigo-950 text-indigo-100 border-t border-indigo-900 rounded-t-3xl p-6 pb-safe space-y-4 animate-slide-up shadow-2xl z-10">
            {/* Drag Handle Bar */}
            <div className="w-12 h-1 bg-indigo-800 rounded-full mx-auto" />
            
            <div className="flex items-center justify-between border-b border-indigo-900 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                More Actions
              </span>
              <button 
                onClick={() => setIsMoreOpen(false)}
                className="text-indigo-300 hover:text-white p-1 rounded-full hover:bg-indigo-900/50 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-2">
              {adminMoreTabs.map((tab) => {
                const isActive = window.location.pathname.startsWith(tab.path);
                return (
                  <NavLink
                    key={tab.name}
                    to={tab.path}
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center space-x-4 p-3 rounded-2xl text-sm font-semibold transition-colors ${
                      isActive 
                        ? 'bg-indigo-900 text-white shadow-md' 
                        : 'text-indigo-200 hover:bg-indigo-900/50 hover:text-white'
                    }`}
                  >
                    <tab.icon className="h-5 w-5 shrink-0" />
                    <span>{tab.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileTabBar;
