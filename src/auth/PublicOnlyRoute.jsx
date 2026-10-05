/**
 * PublicOnlyRoute
 *
 * Wraps routes that should only be visible to unauthenticated users
 * (e.g. /login-page).
 *
 * Behaviour:
 *  - While auth is resolving: render loader (same as ProtectedRoute) so the
 *    login page doesn't flash before the redirect to /dashboard fires.
 *  - Authenticated: redirect to /dashboard.
 *  - Unauthenticated: render children normally.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

function AuthLoadingScreen() {
  return (
    <div className="w-full h-[100dvh] flex items-center justify-center bg-[#FAF7F2]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
        <span className="text-[12px] font-medium text-stone-400 tracking-wide uppercase">
          Loading…
        </span>
      </div>
    </div>
  );
}

export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
