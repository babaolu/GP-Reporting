import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import UnitHeadSidebar from './UnitHeadSidebar';
import MobileTabBar from './MobileTabBar';
import { Loader2 } from 'lucide-react';

export const UnitHeadLayout: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-bg">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  // Redirect if not logged in
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Intercept and force onboarding if profile is not complete
  if (user.is_first_login) {
    return <Navigate to="/auth/onboarding" replace />;
  }

  // Redirect if they are an admin trying to access unit-head space
  if (user.role !== 'unit_head') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="flex min-h-screen bg-page-bg font-sans">
      {/* Desktop Sidebar */}
      <UnitHeadSidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar />
    </div>
  );
};
export default UnitHeadLayout;
