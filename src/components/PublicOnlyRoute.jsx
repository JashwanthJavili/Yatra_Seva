import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    // If already authenticated, redirect to /dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
