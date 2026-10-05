/**
 * ProtectedRoute
 *
 * Wraps routes that require authentication.
 *
 * Behaviour:
 *  - While auth is resolving (isLoading): render a full-screen neutral loader
 *    so protected content never flashes before the session is confirmed.
 *  - Authenticated: render children normally.
 *  - Unauthenticated: redirect to /login-page, preserving the attempted URL
 *    in location.state.from so the login screen can redirect back after sign-in.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Don't make any routing decision until Firebase has resolved the session
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login-page" state={{ from: location }} replace />;
  }

  return children;
}

// ─── Minimal full-screen loader ───────────────────────────────────────────────
// Shown only for the brief moment while Firebase resolves the persisted session.
// Matches the app's warm cream palette so there is no jarring white flash.

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
