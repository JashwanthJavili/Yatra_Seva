import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Auth
import { AuthProvider } from './auth/AuthProvider';
import ProtectedRoute   from './auth/ProtectedRoute';
import PublicOnlyRoute  from './auth/PublicOnlyRoute';

// Screens — public
import WelcomeScreen    from './components/WelcomeScreen';
import AdminLoginScreen from './components/AdminLoginScreen';

// Screens — protected
import DashboardScreen           from './components/DashboardScreen';
import QRScanScreen              from './components/scan/QRScanScreen';
import RegistrationDetailsScreen from './components/RegistrationDetailsScreen';
import EventsScreen              from './components/events/EventsScreen';
import EventDetailScreen         from './components/events/EventDetailScreen';
import VolunteersScreen          from './components/volunteers/VolunteersScreen';
import NotFoundScreen            from './components/NotFoundScreen';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="w-full min-h-screen h-[100dvh] overflow-hidden flex flex-col font-['Poppins',sans-serif] antialiased text-stone-800 bg-[#FAF7F2]">
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/welcome-page" replace />} />

            {/* ── Public ──────────────────────────────────────────────────── */}
            <Route path="/welcome-page" element={<WelcomeScreen />} />
            <Route
              path="/login-page"
              element={
                <PublicOnlyRoute>
                  <AdminLoginScreen />
                </PublicOnlyRoute>
              }
            />

            {/* ── Protected ───────────────────────────────────────────────── */}
            <Route
              path="/dashboard"
              element={<ProtectedRoute><DashboardScreen /></ProtectedRoute>}
            />

            {/* Events */}
            <Route
              path="/events"
              element={<ProtectedRoute><EventsScreen /></ProtectedRoute>}
            />
            <Route
              path="/events/:eventId"
              element={<ProtectedRoute><EventDetailScreen /></ProtectedRoute>}
            />

            {/* QR Scanner */}
            <Route
              path="/scan"
              element={<ProtectedRoute><QRScanScreen /></ProtectedRoute>}
            />

            {/* Registration details
                :docId = URL-encoded Firestore document ID (= sanitised QR value)
                ?eventId= passed as search param so the route stays clean       */}
            <Route
              path="/registration/:docId"
              element={<ProtectedRoute><RegistrationDetailsScreen /></ProtectedRoute>}
            />

            {/* Volunteers */}
            <Route
              path="/volunteers"
              element={<ProtectedRoute><VolunteersScreen /></ProtectedRoute>}
            />

            {/* 404 */}
            <Route path="*" element={<NotFoundScreen />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
