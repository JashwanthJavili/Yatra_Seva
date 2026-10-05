/**
 * AuthProvider — Firebase-backed authentication context
 *
 * Provides to the whole app:
 *  - firebaseUser   : Firebase Auth User object (or null)
 *  - userProfile    : Firestore UserProfile document (or null)
 *  - role           : UserRole string shortcut
 *  - isAuthenticated: boolean
 *  - isLoading      : true while auth state is being resolved (prevents flash)
 *  - login()        : sign in with email + password
 *  - logout()       : Firebase signOut
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import auth from '../firebase/auth';
import { getUserProfile } from '../firebase/firestore';

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ─── Error message mapping ───────────────────────────────────────────────────

/**
 * Convert raw Firebase Auth error codes into friendly user-facing messages.
 * Never expose the raw error code or message to the UI.
 *
 * @param {string} code  Firebase error code, e.g. "auth/wrong-password"
 * @returns {string}
 */
function friendlyAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid. Please check and try again.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      // Deliberately vague — do not reveal whether the email exists
      return 'Incorrect email or password. Please try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your administrator.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  // null  → not yet resolved
  // false → resolved, unauthenticated
  // User  → resolved, authenticated Firebase user
  const [firebaseUser, setFirebaseUser] = useState(null);

  /** @type {[import('../types/user').UserProfile | null, Function]} */
  const [userProfile, setUserProfile]   = useState(null);

  // true while Firebase is resolving the persisted auth session on first load
  const [isLoading, setIsLoading]       = useState(true);

  // ── Subscribe to Firebase Auth state ──────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // Fetch Firestore profile every time auth state resolves
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } catch (err) {
          console.error('[AuthProvider] Failed to load user profile:', err);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setIsLoading(false);
    });

    return unsubscribe; // clean up listener on unmount
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged will handle setting firebaseUser + userProfile
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: friendlyAuthError(err.code),
      };
    }
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await signOut(auth);
    // onAuthStateChanged will clear firebaseUser + userProfile
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const isAuthenticated = Boolean(firebaseUser);
  const role            = userProfile?.role ?? null;
  const isSuperAdmin    = role === 'SUPER_ADMIN';

  const value = {
    firebaseUser,
    userProfile,
    role,
    isSuperAdmin,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
