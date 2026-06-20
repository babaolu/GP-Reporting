import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Layout wrappers
import AdminLayout from './components/layout/AdminLayout';
import UnitHeadLayout from './components/layout/UnitHeadLayout';

// Auth pages
import { Login } from './routes/auth/Login';
import { ForgotPassword } from './routes/auth/ForgotPassword';
import { ResetPassword } from './routes/auth/ResetPassword';
import { Onboarding } from './routes/auth/Onboarding';

// Admin pages
import AdminOverview from './routes/admin/Overview';
import AdminUnits from './routes/admin/Units';
import AdminUnitDetail from './routes/admin/UnitDetail';
import AdminMonthly from './routes/admin/Monthly';
import AdminLeaderboard from './routes/admin/Leaderboard';
import AdminSummaries from './routes/admin/Summaries';
import AdminUsers from './routes/admin/Users';
import AdminSettings from './routes/admin/Settings';

// Unit Head pages
import UnitHeadOverview from './routes/unit-head/Overview';
import UnitHeadReport from './routes/unit-head/Report';
import UnitHeadHistory from './routes/unit-head/History';
import UnitHeadSettings from './routes/unit-head/Settings';

const queryClient = new QueryClient();

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Guest Auth Routes */}
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            
            {/* Onboarding intercepter */}
            <Route path="/auth/onboarding" element={<Onboarding />} />

            {/* Admin routes group (Guarded) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="units" element={<AdminUnits />} />
              <Route path="units/:id" element={<AdminUnitDetail />} />
              <Route path="monthly" element={<AdminMonthly />} />
              <Route path="leaderboard" element={<AdminLeaderboard />} />
              <Route path="summaries" element={<AdminSummaries />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Unit Head routes group (Guarded) */}
            <Route path="/unit-head" element={<UnitHeadLayout />}>
              <Route index element={<UnitHeadOverview />} />
              <Route path="report" element={<UnitHeadReport />} />
              <Route path="history" element={<UnitHeadHistory />} />
              <Route path="settings" element={<UnitHeadSettings />} />
            </Route>

            {/* Fallback Catch-All */}
            <Route path="*" element={<Navigate to="/auth/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
