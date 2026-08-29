import { PmsDataProvider } from '@/contexts/PmsDataContext';
import React, { Suspense, lazy } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import RoleRoute from './components/RoleRoute';

// Route-level code splitting: each page is loaded on demand, keeping the initial
// bundle small (the current single-chunk build exceeds 1 MB).
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProgrammesPage = lazy(() => import('./pages/ProgrammesPage'));
const ProgrammeDetailPage = lazy(() => import('./pages/ProgrammeDetailPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const OpportunitiesPage = lazy(() => import('./pages/OpportunitiesPage'));
const QuotationsPage = lazy(() => import('./pages/QuotationsPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
const ParticipantsPage = lazy(() => import('./pages/ParticipantsPage'));
const ActionItemsPage = lazy(() => import('./pages/ActionItemsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AdministrationPage = lazy(() => import('./pages/AdministrationPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'));

const guarded = (path, element) => <RoleRoute path={path}>{element}</RoleRoute>;

const fallback = (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <PmsDataProvider>
        <Router>
          <ScrollToTop />
          <Toaster position="top-right" richColors closeButton />
          <Suspense fallback={fallback}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={guarded('/', <DashboardPage />)} />
                <Route path="/programmes" element={guarded('/programmes', <ProgrammesPage />)} />
                <Route path="/programmes/:id" element={guarded('/programmes', <ProgrammeDetailPage />)} />
                <Route path="/clients" element={guarded('/clients', <ClientsPage />)} />
                <Route path="/opportunities" element={guarded('/opportunities', <OpportunitiesPage />)} />
                <Route path="/quotations" element={guarded('/quotations', <QuotationsPage />)} />
                <Route path="/purchase-orders" element={guarded('/purchase-orders', <PurchaseOrdersPage />)} />
                <Route path="/invoices" element={guarded('/invoices', <InvoicesPage />)} />
                <Route path="/payments" element={guarded('/payments', <PaymentsPage />)} />
                <Route path="/training" element={guarded('/training', <TrainingPage />)} />
                <Route path="/participants" element={guarded('/participants', <ParticipantsPage />)} />
                <Route path="/action-items" element={guarded('/action-items', <ActionItemsPage />)} />
                <Route path="/reports" element={guarded('/reports', <ReportsPage />)} />
                <Route path="/administration" element={guarded('/administration', <AdministrationPage />)} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </PmsDataProvider>
    </AuthProvider>
  );
}

export default App;
