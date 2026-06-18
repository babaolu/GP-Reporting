import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  LayoutDashboard, 
  Layers, 
  CalendarDays, 
  Settings, 
  FileInput, 
  History 
} from 'lucide-react';

export const MobileTabBar: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  const adminTabs = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Units', path: '/admin/units', icon: Layers },
    { name: 'Reports', path: '/admin/monthly', icon: CalendarDays },
    { name: 'Settings', path: '/admin/settings', icon: Settings }
  ];

  const unitHeadTabs = [
    { name: 'Dashboard', path: '/unit-head', icon: LayoutDashboard },
    { name: 'Submit', path: '/unit-head/report', icon: FileInput },
    { name: 'History', path: '/unit-head/history', icon: History },
    { name: 'Settings', path: '/unit-head/settings', icon: Settings }
  ];

  const activeTabs = user.role === 'admin' ? adminTabs : unitHeadTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-indigo-950 text-indigo-200 border-t border-indigo-900 flex justify-around py-2 md:hidden z-50">
      {activeTabs.map((tab) => (
        <NavLink
          key={tab.name}
          to={tab.path}
          end={tab.path === '/admin' || tab.path === '/unit-head'}
          className={({ isActive }) =>
            `flex flex-col items-center space-y-1 py-1 px-3 rounded-lg text-xs font-semibold transition-colors ${
              isActive 
                ? 'text-white font-bold bg-indigo-900' 
                : 'text-indigo-300 hover:text-white'
            }`
          }
        >
          <tab.icon className="h-5 w-5" />
          <span>{tab.name}</span>
        </NavLink>
      ))}
    </nav>
  );
};
export default MobileTabBar;
