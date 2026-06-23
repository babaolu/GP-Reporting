import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import AdminSidebar from './AdminSidebar';
import MobileTabBar from './MobileTabBar';
import { Loader2 } from 'lucide-react';

export const AdminLayout: React.FC = () => {
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

  // Redirect if they are a unit head trying to access admin
  if (user.role !== 'admin') {
    return <Navigate to="/unit-head" replace />;
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-page-bg font-sans">
      {/* Desktop Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-28 lg:pb-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar />
    </div>
  );
};
export default AdminLayout;
