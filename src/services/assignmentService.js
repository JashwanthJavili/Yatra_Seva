/**
 * assignmentService.js — Firestore operations for event ↔ volunteer assignments.
 *
 * Collection: eventAssignments/{assignmentId}
 * Document ID: derived as `{eventId}_{volunteerUid}` for easy lookup and
 * natural deduplication (set() with merge:false is idempotent).
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import db from '../firebase/firestore';
import { ASSIGNMENT_STATUS } from '../types/assignment';

const ASSIGNMENTS_COLLECTION = 'eventAssignments';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a deterministic document ID from eventId + volunteerUid */
function assignmentDocId(eventId, volunteerUid) {
  return `${eventId}_${volunteerUid}`;
}

// ─── Create / Remove ──────────────────────────────────────────────────────────

/**
 * Assign a volunteer to an event.
 * If an assignment already exists (even REMOVED), it is re-activated.
 *
 * @param {{
 *   eventId: string,
 *   volunteerUid: string,
 *   volunteerName: string,
 *   volunteerUserId: string,
 *   assignedBy: string,
 * }} params
 * @returns {Promise<string>} assignmentId
 */
export async function assignVolunteer({ eventId, volunteerUid, volunteerName, volunteerUserId, assignedBy }) {
  const id  = assignmentDocId(eventId, volunteerUid);
  const ref = doc(db, ASSIGNMENTS_COLLECTION, id);

  await setDoc(ref, {
    id,
    eventId,
    volunteerUid,
    volunteerName,
    volunteerUserId,
    assignedBy,
    assignedAt: serverTimestamp(),
    status:     ASSIGNMENT_STATUS.ACTIVE,
  }, { merge: true }); // merge so re-assignment updates timestamps without losing extra fields

  return id;
}

/**
 * Remove (soft-delete) a volunteer assignment.
 * We never hard-delete assignments — the history is valuable for auditing.
 *
 * @param {string} eventId
 * @param {string} volunteerUid
 */
export async function removeAssignment(eventId, volunteerUid) {
  const id  = assignmentDocId(eventId, volunteerUid);
  await updateDoc(doc(db, ASSIGNMENTS_COLLECTION, id), {
    status:    ASSIGNMENT_STATUS.REMOVED,
    removedAt: serverTimestamp(),
  });
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get all ACTIVE assignments for a specific event.
 * @param {string} eventId
 * @returns {Promise<import('../types/assignment').EventAssignment[]>}
 */
export async function getAssignmentsForEvent(eventId) {
  const q    = query(
    collection(db, ASSIGNMENTS_COLLECTION),
    where('eventId', '==', eventId),
    where('status',  '==', ASSIGNMENT_STATUS.ACTIVE),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

/**
 * Get all ACTIVE assignments for a specific volunteer.
 * @param {string} volunteerUid
 * @returns {Promise<import('../types/assignment').EventAssignment[]>}
 */
export async function getAssignmentsForUser(volunteerUid) {
  const q    = query(
    collection(db, ASSIGNMENTS_COLLECTION),
    where('volunteerUid', '==', volunteerUid),
    where('status',       '==', ASSIGNMENT_STATUS.ACTIVE),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

/**
 * Get just the event IDs a volunteer is assigned to (lightweight check).
 * @param {string} volunteerUid
 * @returns {Promise<string[]>}
 */
export async function getAssignedEventIds(volunteerUid) {
  const assignments = await getAssignmentsForUser(volunteerUid);
  return assignments.map((a) => a.eventId);
}

/**
 * Check if a specific volunteer is assigned to a specific event.
 * @param {string} eventId
 * @param {string} volunteerUid
 * @returns {Promise<boolean>}
 */
export async function isVolunteerAssigned(eventId, volunteerUid) {
  const q    = query(
    collection(db, ASSIGNMENTS_COLLECTION),
    where('eventId',      '==', eventId),
    where('volunteerUid', '==', volunteerUid),
    where('status',       '==', ASSIGNMENT_STATUS.ACTIVE),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
