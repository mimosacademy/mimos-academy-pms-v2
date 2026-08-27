import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = ({ children, redirectTo = '/login' }) => {
  const { isAuthed, loading } = useAuth();

  // Never redirect while Supabase is still resolving the persisted session.
  // The previous implementation treated the initial `false` value of
  // `isAuthed` as a definitive unauthenticated state, causing a login -> app
  // navigation race and visible flicker/blank transitions on cold loads.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
          <p className="mt-3 text-sm text-slate-500">Loading MIMOS Academy PMS…</p>
        </div>
      </div>
    );
  }

  if (!isAuthed) return <Navigate to={redirectTo} replace />;

  return children;
};

export default ProtectedRoute;

export { ProtectedRoute };