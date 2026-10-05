/**
 * verificationService.js
 *
 * ATOMICITY:
 * verifyDevotee() uses a Firestore transaction — two volunteers scanning the
 * same QR simultaneously cannot both succeed. First writer wins; second gets
 * an "already verified" result gracefully.
 *
 * DATA MODEL:
 * Registration documents use the sourceData / systemData split.
 * Individual devotee verification state lives in systemData.devotees[].
 * sourceData is NEVER modified after import.
 *
 * REAL-TIME:
 * getRegistrationLive() attaches an onSnapshot listener so all open
 * screens refresh automatically when another volunteer verifies.
 */

import {
  collection,
  doc,
  runTransaction,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  getCountFromServer,
} from 'firebase/firestore';
import db from '../firebase/firestore';
import { VERIFICATION_ACTIONS } from '../types/assignment';
import { REGISTRATION_STATUS } from '../types/registration';

const LOGS_COLLECTION = 'verificationLogs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function regRef(eventId, docId) {
  return doc(db, 'events', eventId, 'registrations', docId);
}

/**
 * Intelligent helper to extract devotee name from sourceData.
 * Checks known aliases, generic name columns, first/last names, and non-empty text columns.
 */
export function extractDevoteeName(index, sourceData) {
  if (!sourceData) return null;
  const entries = Object.entries(sourceData);

  if (index === 0) {
    // 1. Exact / common alias match
    for (const [k, v] of entries) {
      if (!v) continue;
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if ([
        'fullname', 'name', 'devoteename', 'devotee', 'primarydevotee',
        'candidatename', 'participantname', 'applicantname', 'devoteefullname',
        'contactperson', 'personname', 'passengername', 'leadername', 'firstname',
      ].includes(norm)) {
        return String(v).trim();
      }
    }
    // 2. Any field containing name/devotee without [2-9]
    for (const [k, v] of entries) {
      if (!v) continue;
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        (norm.includes('name') || norm.includes('devotee') || norm.includes('candidate') || norm.includes('person')) &&
        !/[2-9]/.test(norm) &&
        !norm.includes('total') &&
        !norm.includes('count') &&
        !norm.includes('number') &&
        !norm.includes('event') &&
        !norm.includes('father') &&
        !norm.includes('mother') &&
        !norm.includes('spouse')
      ) {
        return String(v).trim();
      }
    }
    // 3. Combine First Name & Last Name if present
    const fn = entries.find(([k]) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('firstname'))?.[1];
    const ln = entries.find(([k]) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('lastname'))?.[1];
    if (fn || ln) {
      return `${fn || ''} ${ln || ''}`.trim();
    }
    // 4. Fallback to first non-empty text string that isn't ID/phone/email/date
    for (const [k, v] of entries) {
      if (!v || typeof v !== 'string') continue;
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        !norm.includes('id') &&
        !norm.includes('phone') &&
        !norm.includes('mobile') &&
        !norm.includes('email') &&
        !norm.includes('date') &&
        !norm.includes('time') &&
        !norm.includes('status') &&
        !norm.includes('amount') &&
        !norm.includes('qr') &&
        !norm.includes('pass') &&
        v.length > 1 &&
        v.length < 50 &&
        !/^\d+$/.test(v)
      ) {
        return v.trim();
      }
    }
  } else {
    // Dependent devotees (index 1, 2, ...)
    const n = index + 1;
    for (const [k, v] of entries) {
      if (!v) continue;
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        (norm.includes(`devotee${n}`) || norm.includes(`member${n}`) || norm.includes(`person${n}`) || norm.includes(`name${n}`)) &&
        !norm.includes('phone') && !norm.includes('age') && !norm.includes('gender')
      ) {
        return String(v).trim();
      }
    }
  }

  return null;
}

// ─── Atomic devotee verification ─────────────────────────────────────────────

/**
 * Atomically verify a single devotee and mark goodie as issued.
 *
 * The systemData.devotees array mirrors the source devotee list but carries
 * only verification state (no Excel data). Index 0 = primary registrant.
 *
 * Transaction guarantees:
 *  1. Read systemData inside the transaction.
 *  2. If devotees[devoteeIndex].status === 'VERIFIED' → return alreadyVerified.
 *  3. Otherwise stamp VERIFIED + set goodieKitIssued on that devotee.
 *  4. If ALL devotees are now VERIFIED → set systemData.status = VERIFIED.
 *
 * @param {{
 *   eventId: string,
 *   docId: string,
 *   devoteeIndex: number,   0-based
 *   devoteeName: string,
 *   performedBy: string,    volunteer uid
 *   performedByName: string,
 *   totalDevotees: number,  total devotees in this registration
 * }} params
 * @returns {Promise<{ success: boolean, alreadyVerified: boolean }>}
 */
export async function verifyDevotee({
  eventId, docId, devoteeIndex, devoteeName, performedBy, performedByName, totalDevotees,
}) {
  const ref = regRef(eventId, docId);
  let resolvedDevoteeName = devoteeName;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Registration not found.');

      const data       = snap.data();
      const sysData    = data.systemData ?? {};
      const sourceData = data.sourceData ?? {};

      // If devoteeName is missing or generic, resolve directly from sourceData
      if (!resolvedDevoteeName || resolvedDevoteeName.startsWith('Devotee')) {
        resolvedDevoteeName = extractDevoteeName(devoteeIndex, sourceData) || resolvedDevoteeName || `Devotee ${devoteeIndex + 1}`;
      }

      // Initialise devotees array if first verification ever
      const devotees = Array.isArray(sysData.devotees)
        ? [...sysData.devotees]
        : Array.from({ length: totalDevotees }, () => ({
            status:         REGISTRATION_STATUS.PENDING,
            goodieKitIssued: false,
          }));

      // Ensure array is long enough
      while (devotees.length <= devoteeIndex) {
        devotees.push({ status: REGISTRATION_STATUS.PENDING, goodieKitIssued: false });
      }

      const target = devotees[devoteeIndex];

      // Atomic idempotency check
      if (target.status === REGISTRATION_STATUS.VERIFIED) {
        throw Object.assign(new Error('Already verified.'), { alreadyVerified: true });
      }

      // Stamp this devotee
      devotees[devoteeIndex] = {
        ...target,
        devoteeName:     resolvedDevoteeName,
        status:          REGISTRATION_STATUS.VERIFIED,
        goodieKitIssued: true,
        verifiedBy:      performedBy,
        verifiedByName:  performedByName,
        verifiedAt:      Timestamp.now(),
        goodieIssuedAt:  Timestamp.now(),
      };

      const allDone = devotees.every((d) => d.status === REGISTRATION_STATUS.VERIFIED);

      tx.update(ref, {
        'systemData.devotees':           devotees,
        'systemData.status':             allDone ? REGISTRATION_STATUS.VERIFIED : REGISTRATION_STATUS.PENDING,
        'systemData.goodieKitIssued':    devotees.some((d) => d.goodieKitIssued),
        'systemData.lastVerifiedBy':     performedBy,
        'systemData.lastVerifiedByName': performedByName,
        'systemData.lastVerifiedAt':     serverTimestamp(),
      });
    });

    // Immutable audit log (outside transaction — best effort)
    await writeVerificationLog({
      eventId,
      registrationId: docId,
      devoteeIndex:   String(devoteeIndex),
      devoteeName:    resolvedDevoteeName,
      action:         VERIFICATION_ACTIONS.GOODIE_ISSUED,
      performedBy,
      performedByName,
    });

    return { success: true, alreadyVerified: false };

  } catch (err) {
    if (err.alreadyVerified) return { success: false, alreadyVerified: true };
    throw err;
  }
}

// ─── Real-time listener ───────────────────────────────────────────────────────

/**
 * Attach a real-time Firestore listener to a single registration document.
 *
 * @param {string}   eventId
 * @param {string}   docId
 * @param {(doc: import('../types/registration').RegistrationDoc | null) => void} onData
 * @param {(err: Error) => void} onError
 * @returns {() => void}  unsubscribe function — call on component unmount
 */
export function getRegistrationLive(eventId, docId, onData, onError) {
  return onSnapshot(
    regRef(eventId, docId),
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      onData({ ...snap.data(), _id: snap.id });
    },
    onError,
  );
}

// ─── Audit log ────────────────────────────────────────────────────────────────

/**
 * Write an immutable verification log entry.
 * Security rules deny update/delete on this collection.
 *
 * @param {{
 *   eventId: string,
 *   registrationId: string,
 *   devoteeIndex: string,
 *   action: string,
 *   performedBy: string,
 *   performedByName: string,
 *   note?: string,
 * }} entry
 */
export async function writeVerificationLog(entry) {
  const ref = await addDoc(collection(db, LOGS_COLLECTION), {
    ...entry,
    performedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Fetch verification logs for a registration (most recent first).
 */
export async function getVerificationLogs(eventId, registrationId) {
  const q    = query(
    collection(db, LOGS_COLLECTION),
    where('eventId',        '==', eventId),
    where('registrationId', '==', registrationId),
    orderBy('performedAt',  'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

/**
 * Get count of devotees verified by a volunteer (returns ONLY number, NO names).
 * Used by verification agents to see their personal seva tally.
 *
 * @param {string} volunteerUid
 * @param {string|null} eventId  - optional filter by event
 * @returns {Promise<number>}
 */
export async function getVolunteerVerificationCount(volunteerUid, eventId = null) {
  try {
    const constraints = [
      where('performedBy', '==', volunteerUid),
      where('action', '==', VERIFICATION_ACTIONS.GOODIE_ISSUED),
    ];
    if (eventId) constraints.push(where('eventId', '==', eventId));
    const q = query(collection(db, LOGS_COLLECTION), ...constraints);
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    // Fallback if composite index is pending
    try {
      const q = query(collection(db, LOGS_COLLECTION), where('performedBy', '==', volunteerUid));
      const snap = await getDocs(q);
      let docs = snap.docs.map((d) => d.data());
      if (eventId) docs = docs.filter((d) => d.eventId === eventId);
      return docs.filter((d) => d.action === VERIFICATION_ACTIONS.GOODIE_ISSUED).length;
    } catch {
      return 0;
    }
  }
}

/**
 * Get verification stats for all volunteers in an event (SUPER_ADMIN only).
 * Returns count AND full devotee details (name, registration ID, time).
 *
 * @param {string} eventId
 * @returns {Promise<Record<string, { count: number, devotees: Array<{ id: string, devoteeName: string, registrationId: string, performedAt: any }> }>>}
 */
export async function getEventVerificationStatsByVolunteer(eventId) {
  try {
    const [snap, regSnap] = await Promise.all([
      getDocs(query(collection(db, LOGS_COLLECTION), where('eventId', '==', eventId))),
      getDocs(collection(db, 'events', eventId, 'registrations')),
    ]);

    const regMap = new Map();
    regSnap.forEach((rd) => regMap.set(rd.id, rd.data()));

    const stats = {};
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.action !== VERIFICATION_ACTIONS.GOODIE_ISSUED) return;
      const uid = data.performedBy;
      if (!uid) return;
      if (!stats[uid]) {
        stats[uid] = { count: 0, devotees: [] };
      }
      stats[uid].count += 1;

      const idx = Number(data.devoteeIndex || 0);
      let name = data.devoteeName;

      // If devoteeName is generic ("Devotee 1") or missing, resolve from the registration!
      if (!name || name.startsWith('Devotee')) {
        const reg = regMap.get(data.registrationId);
        if (reg) {
          const sysDev = reg.systemData?.devotees?.[idx];
          if (sysDev?.devoteeName && !sysDev.devoteeName.startsWith('Devotee')) {
            name = sysDev.devoteeName;
          } else {
            name = extractDevoteeName(idx, reg.sourceData) || name;
          }
        }
      }

      stats[uid].devotees.push({
        id:             docSnap.id,
        devoteeName:    name || `Devotee ${idx + 1}`,
        registrationId: data.registrationId || '—',
        performedAt:    data.performedAt,
        performedByName: data.performedByName || '',
      });
    });
    return stats;
  } catch (err) {
    console.error('[getEventVerificationStatsByVolunteer]', err);
    return {};
  }
}

/**
 * Fetch all devotees verified by a specific volunteer across all events (SUPER_ADMIN only).
 *
 * @param {string} volunteerUid
 * @returns {Promise<Array<{ id: string, devoteeName: string, registrationId: string, eventId: string, performedAt: any }>>}
 */
export async function getVolunteerVerifiedDevotees(volunteerUid) {
  try {
    const q = query(
      collection(db, LOGS_COLLECTION),
      where('performedBy', '==', volunteerUid),
    );
    const snap = await getDocs(q);
    const list = [];
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.action !== VERIFICATION_ACTIONS.GOODIE_ISSUED) return;
      list.push({
        id:             docSnap.id,
        devoteeName:    data.devoteeName || `Devotee ${data.devoteeIndex ? Number(data.devoteeIndex) + 1 : ''}`,
        registrationId: data.registrationId || '—',
        eventId:        data.eventId || '',
        performedAt:    data.performedAt,
      });
    });
    return list;
  } catch (err) {
    console.error('[getVolunteerVerifiedDevotees]', err);
    return [];
  }
}

