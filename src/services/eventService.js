/**
 * Event Service — all Firestore operations for the `events` collection.
 *
 * Components and pages must call these functions instead of writing
 * Firestore queries inline.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import db from '../firebase/firestore';
import { EVENT_STATUSES } from '../types/event';

const EVENTS_COLLECTION = 'events';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Attach the Firestore document ID to the data object.
 * @param {import('firebase/firestore').QueryDocumentSnapshot} snap
 * @returns {import('../types/event').YatraEvent}
 */
function snapToEvent(snap) {
  return { id: snap.id, ...snap.data() };
}

/**
 * Return midnight of a given date in local time (no time component).
 * Used so status comparison is purely date-based, not time-based.
 * @param {Date} d
 * @returns {Date}
 */
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Compute the correct status for an event based on today's date.
 *
 * @param {import('firebase/firestore').Timestamp} startTs
 * @param {import('firebase/firestore').Timestamp} endTs
 * @returns {import('../types/event').EventStatus}
 */
export function computeEventStatus(startTs, endTs) {
  const today = startOfDay(new Date());
  const start = startOfDay(startTs.toDate());
  const end   = startOfDay(endTs.toDate());

  if (today < start) return EVENT_STATUSES.UPCOMING;
  if (today > end)   return EVENT_STATUSES.COMPLETED;
  return EVENT_STATUSES.ACTIVE;
}

/**
 * Resolve the effective startDate for an event.
 * Old documents only have `date`; new ones have `startDate`.
 * @param {import('../types/event').YatraEvent} event
 */
export function resolveStartDate(event) {
  return event.startDate ?? event.date;
}

/**
 * Resolve the effective endDate for an event.
 * Old documents only have `date`; endDate defaults to startDate.
 * @param {import('../types/event').YatraEvent} event
 */
export function resolveEndDate(event) {
  return event.endDate ?? event.startDate ?? event.date;
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a new event document in Firestore.
 *
 * @param {{
 *   name: string,
 *   startDate: import('firebase/firestore').Timestamp,
 *   endDate: import('firebase/firestore').Timestamp,
 *   isSingleDay: boolean,
 *   location: string,
 *   description: string,
 *   createdBy: string,
 * }} payload
 * @returns {Promise<string>} The new document ID
 */
export async function createEvent(payload) {
  const status = computeEventStatus(payload.startDate, payload.endDate);
  const ref = await addDoc(collection(db, EVENTS_COLLECTION), {
    name:        payload.name.trim(),
    startDate:   payload.startDate,
    endDate:     payload.endDate,
    isSingleDay: payload.isSingleDay,
    location:    payload.location.trim(),
    description: payload.description.trim(),
    status,
    createdBy:   payload.createdBy,
    createdAt:   serverTimestamp(),
    updatedAt:   serverTimestamp(),
  });
  return ref.id;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all events, ordered by startDate descending.
 * Falls back to `date` field ordering for legacy documents.
 * @returns {Promise<import('../types/event').YatraEvent[]>}
 */
export async function getEvents() {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    orderBy('startDate', 'desc'),
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map(snapToEvent);
  } catch {
    // Fallback for legacy events that only have `date`
    const q2   = query(collection(db, EVENTS_COLLECTION), orderBy('date', 'desc'));
    const snap = await getDocs(q2);
    return snap.docs.map(snapToEvent);
  }
}

/**
 * Fetch a single event by its document ID.
 * Returns null if not found.
 * @param {string} eventId
 * @returns {Promise<import('../types/event').YatraEvent | null>}
 */
export async function getEventById(eventId) {
  const snap = await getDoc(doc(db, EVENTS_COLLECTION, eventId));
  if (!snap.exists()) return null;
  return snapToEvent(snap);
}

/**
 * Fetch event counts for the dashboard stats.
 * Returns { total, active, upcoming, completed }.
 * @returns {Promise<{ total: number, active: number, upcoming: number, completed: number }>}
 */
export async function getEventStats() {
  const snap = await getDocs(collection(db, EVENTS_COLLECTION));
  const events = snap.docs.map((d) => d.data());

  return {
    total:     events.length,
    active:    events.filter((e) => e.status === EVENT_STATUSES.ACTIVE).length,
    upcoming:  events.filter((e) => e.status === EVENT_STATUSES.UPCOMING).length,
    completed: events.filter((e) => e.status === EVENT_STATUSES.COMPLETED).length,
  };
}

// ─── Auto-sync statuses ───────────────────────────────────────────────────────

/**
 * Given an already-loaded list of events, compute the correct status
 * for each one from today's date and write back to Firestore only where
 * the status has changed. Returns the corrected event list.
 *
 * Call this after every `getEvents()` or `getEventById()` so that status
 * transitions happen automatically without needing Cloud Functions.
 *
 * @param {import('../types/event').YatraEvent[]} events
 * @returns {Promise<import('../types/event').YatraEvent[]>}
 */
export async function syncEventStatuses(events) {
  const corrected = await Promise.all(
    events.map(async (ev) => {
      const startTs = resolveStartDate(ev);
      const endTs   = resolveEndDate(ev);

      // Can't compute without date info — leave as-is
      if (!startTs || !endTs) return ev;

      const correct = computeEventStatus(startTs, endTs);
      if (correct === ev.status) return ev;

      try {
        await updateDoc(doc(db, EVENTS_COLLECTION, ev.id), {
          status:    correct,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[syncEventStatuses] Could not update', ev.id, err);
      }

      return { ...ev, status: correct };
    })
  );
  return corrected;
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Update editable fields on an existing event.
 * Always stamps updatedAt and recomputes status from new dates.
 *
 * @param {string} eventId
 * @param {{
 *   name?: string,
 *   startDate?: import('firebase/firestore').Timestamp,
 *   endDate?: import('firebase/firestore').Timestamp,
 *   isSingleDay?: boolean,
 *   location?: string,
 *   description?: string,
 * }} updates
 */
export async function updateEvent(eventId, updates) {
  const clean = {};
  if (updates.name        !== undefined) clean.name        = updates.name.trim();
  if (updates.startDate   !== undefined) clean.startDate   = updates.startDate;
  if (updates.endDate     !== undefined) clean.endDate     = updates.endDate;
  if (updates.isSingleDay !== undefined) clean.isSingleDay = updates.isSingleDay;
  if (updates.location    !== undefined) clean.location    = updates.location.trim();
  if (updates.description !== undefined) clean.description = updates.description.trim();

  // Recompute status if dates changed
  if (clean.startDate || clean.endDate) {
    // Fetch current doc to fill in whichever date wasn't provided
    const current = await getEventById(eventId);
    const startTs = clean.startDate ?? resolveStartDate(current);
    const endTs   = clean.endDate   ?? resolveEndDate(current);
    if (startTs && endTs) clean.status = computeEventStatus(startTs, endTs);
  }

  await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Store (or update) the QR identifier column selection for an event.
 * This is set by the Super Admin during the first Excel import.
 *
 * @param {string} eventId
 * @param {string} qrIdentifierColumn  - exact Excel column header chosen as the QR key
 */
export async function updateEventQrColumn(eventId, qrIdentifierColumn) {
  await updateDoc(doc(db, EVENTS_COLLECTION, eventId), {
    qrIdentifierColumn,
    updatedAt: serverTimestamp(),
  });
}
