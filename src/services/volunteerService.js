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
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import db from '../firebase/firestore';
import { USER_ROLES, USER_STATUSES } from '../types/user';

const USERS_COLLECTION = 'users';

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all volunteer/agent profiles from Firestore.
 * Super Admin profiles are excluded from the list (they're managed separately).
 *
 * @returns {Promise<import('../types/user').UserProfile[]>}
 */
export async function getVolunteers() {
  const q    = query(
    collection(db, USERS_COLLECTION),
    where('role', '==', USER_ROLES.VERIFICATION_AGENT),
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ ...d.data(), uid: d.id }));
  // Sort client-side — avoids requiring a composite Firestore index
  return docs.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

/**
 * Fetch all user profiles regardless of role (for assignment dropdowns).
 * @returns {Promise<import('../types/user').UserProfile[]>}
 */
export async function getAllUsers() {
  const snap = await getDocs(query(collection(db, USERS_COLLECTION), orderBy('name')));
  return snap.docs.map((d) => ({ ...d.data(), uid: d.id }));
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
 * Create the Firestore profile document for a new volunteer.
 *
 * PRE-CONDITION: The Firebase Authentication account for this UID must already
 * exist (created via Firebase Console or a backend Cloud Function).
 * This function ONLY writes the Firestore document — it does NOT create the
 * Auth account.
 *
 * @param {{
 *   uid: string,
 *   name: string,
 *   userId: string,
 *   email: string,
 *   role?: import('../types/user').UserRole,
 *   createdBy: string,
 * }} profileData
 * @returns {Promise<void>}
 */
export async function createVolunteerProfile(profileData) {
  const { uid, name, userId, email, role, createdBy } = profileData;

  if (!uid)   throw new Error('uid is required — create the Firebase Auth account first.');
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
