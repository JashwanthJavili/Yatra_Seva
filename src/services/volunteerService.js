/**
 * volunteerService.js — Firestore operations for user/volunteer profiles.
 *
 * IMPORTANT — Firebase Auth account creation:
 * Creating a new Firebase Authentication user requires either:
 *   (a) The Firebase Admin SDK running on a trusted server/Cloud Function, OR
 *   (b) The user self-registering (not applicable for volunteers).
 *
 * The browser-side Firebase SDK can only create accounts via
 * createUserWithEmailAndPassword() which signs the caller OUT of their
 * current session — unacceptable for a Super Admin adding agents.
 *
 * The `createVolunteerProfile()` function below writes only the Firestore
 * profile document. The Auth account MUST be created separately via:
 *   1. Firebase Console → Authentication → Add User  (manual)
 *   2. A Cloud Function / backend endpoint (recommended for production)
 *
 * See ADMIN_SETUP.md for the full procedure.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import db from '../firebase/firestore';
import { firebaseConfig } from '../firebase/config';
import { USER_ROLES, USER_STATUSES } from '../types/user';

const USERS_COLLECTION = 'users';

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all users (Super Admins, Admins, Volunteers) from Firestore.
 * @returns {Promise<import('../types/user').UserProfile[]>}
 */
export async function getAllUsers() {
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  const docs = snap.docs.map((d) => ({ ...d.data(), uid: d.id }));
  return docs.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

/**
 * Fetch all volunteer/agent profiles from Firestore.
 * @returns {Promise<import('../types/user').UserProfile[]>}
 */
export async function getVolunteers() {
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  const docs = snap.docs.map((d) => ({ ...d.data(), uid: d.id }));
  return docs.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

/**
 * Fetch a single user profile by UID.
 * @param {string} uid
 * @returns {Promise<import('../types/user').UserProfile | null>}
 */
export async function getVolunteerById(uid) {
  const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (!snap.exists()) return null;
  return { ...snap.data(), uid: snap.id };
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Friendly error messages for user creation
 */
function friendlyCreationError(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/invalid-email':
      return 'The email address is invalid. Please check and try again.';
    case 'auth/weak-password':
      return 'The password is too weak. Please use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase Console.';
    default:
      return null;
  }
}

/**
 * Directly creates both the Firebase Authentication user account AND the Firestore
 * profile document from within the Super Admin portal, WITHOUT signing out the
 * currently logged-in Super Admin.
 *
 * @param {{
 *   name: string,
 *   email: string,
 *   password: string,
 *   role: import('../types/user').UserRole,
 *   userId?: string,
 *   createdBy?: string,
 * }} userData
 * @returns {Promise<import('../types/user').UserProfile>}
 */
export async function createPortalUser({ name, email, password, role, userId, createdBy }) {
  if (!name?.trim()) throw new Error('Full name is required.');
  if (!email?.trim()) throw new Error('Email address is required.');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

  const chosenRole = role || USER_ROLES.VERIFICATION_AGENT;
  let defaultPrefix = 'VOL';
  if (chosenRole === USER_ROLES.SUPER_ADMIN) defaultPrefix = 'ADM';
  else if (chosenRole === USER_ROLES.ADMIN) defaultPrefix = 'MGR';

  const customUserId = userId?.trim() || `${defaultPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Create a secondary Firebase App so the Super Admin's active session is never disturbed
  const secondaryAppName = `admin-user-creator-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  let newUid = null;
  try {
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      cleanEmail,
      password
    );
    newUid = userCredential.user.uid;

    // 2. Write profile to Firestore with the primary db instance (authenticated as Super Admin)
    const profileData = {
      uid:       newUid,
      name:      name.trim(),
      userId:    customUserId,
      email:     cleanEmail,
      role:      chosenRole,
      status:    USER_STATUSES.ACTIVE,
      createdBy: createdBy || 'SUPER_ADMIN',
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, USERS_COLLECTION, newUid), profileData);

    // 3. Sign out secondary auth instance
    await signOut(secondaryAuth);

    return profileData;
  } catch (err) {
    const friendly = friendlyCreationError(err.code);
    if (friendly) throw new Error(friendly);
    throw err;
  } finally {
    // 4. Safely clean up the secondary app instance
    try {
      await deleteApp(secondaryApp);
    } catch (cleanupErr) {
      console.warn('[createPortalUser] Cleanup secondary app error:', cleanupErr);
    }
  }
}

/**
 * Legacy/Firestore-only profile creation
 */
export async function createVolunteerProfile(profileData) {
  const { uid, name, userId, email, role, createdBy } = profileData;

  if (!uid)   throw new Error('uid is required.');
  if (!name)  throw new Error('name is required.');
  if (!email) throw new Error('email is required.');

  await setDoc(doc(db, USERS_COLLECTION, uid), {
    uid,
    name:      name.trim(),
    userId:    userId?.trim() || `VOL-${Date.now().toString(36).toUpperCase()}`,
    email:     email.trim().toLowerCase(),
    role:      role ?? USER_ROLES.VERIFICATION_AGENT,
    status:    USER_STATUSES.ACTIVE,
    createdBy,
    createdAt: serverTimestamp(),
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Update a volunteer's status (ACTIVE / INACTIVE / SUSPENDED).
 * @param {string} uid
 * @param {import('../types/user').UserStatus} status
 */
export async function updateVolunteerStatus(uid, status) {
  await updateDoc(doc(db, USERS_COLLECTION, uid), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update editable profile fields.
 * @param {string} uid
 * @param {{ name?: string, userId?: string }} updates
 */
export async function updateVolunteerProfile(uid, updates) {
  const clean = {};
  if (updates.name)   clean.name   = updates.name.trim();
  if (updates.userId) clean.userId = updates.userId.trim();
  await updateDoc(doc(db, USERS_COLLECTION, uid), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Change a user's role (SUPER_ADMIN / ADMIN / VERIFICATION_AGENT).
 * @param {string} uid
 * @param {import('../types/user').UserRole} role
 */
export async function updateUserRole(uid, role) {
  if (!uid) throw new Error('User UID is required.');
  if (!Object.values(USER_ROLES).includes(role)) {
    throw new Error('Invalid role specified.');
  }
  await updateDoc(doc(db, USERS_COLLECTION, uid), {
    role,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Permanently delete a user profile from Firestore and remove their event assignments.
 * @param {string} uid
 */
export async function deleteUserProfile(uid) {
  if (!uid) throw new Error('User UID is required.');

  // 1. Delete user profile document
  await deleteDoc(doc(db, USERS_COLLECTION, uid));

  // 2. Clean up any event assignments for this user
  try {
    const q = query(collection(db, 'eventAssignments'), where('volunteerUid', '==', uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('[deleteUserProfile] Could not clean event assignments:', err);
  }
}

