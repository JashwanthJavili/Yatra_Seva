/**
 * Firestore instance + user-profile helpers
 *
 * All Firestore access for user profiles lives here.
 * UI components and AuthProvider import from this module —
 * never import getFirestore() directly in components.
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import app from './config';

const db = getFirestore(app);

export default db;

// ─── User Profile ────────────────────────────────────────────────────────────

/**
 * Fetch a user's Firestore profile document.
 * Returns the profile object or null if not found.
 *
 * @param {string} uid  Firebase Auth UID
 * @returns {Promise<import('../types/user').UserProfile | null>}
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data();
}

/**
 * Create or overwrite a user profile document in Firestore.
 * Should only be called from a trusted setup script or admin seeder —
 * NOT from regular login flow.
 *
 * @param {string} uid
 * @param {Partial<import('../types/user').UserProfile>} profileData
 */
export async function setUserProfile(uid, profileData) {
  await setDoc(
    doc(db, 'users', uid),
    {
      ...profileData,
      uid,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}
