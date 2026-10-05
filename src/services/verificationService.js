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
 * Intelligent helper to extract devotee name from sourceData for any member index (0 to 3+).
 * Handles:
 *  - Primary (index 0): Name, Full Name, Devotee 1 Name, Participant Name, First/Last Name, etc.
 *  - Group Members (index 1, 2, 3): Devotee 2/3/4 Name, Member 2/3/4, Name 2/3/4, Person 2/3/4, etc.
 */
export function extractDevoteeName(index, sourceData) {
  if (!sourceData) return null;
  const entries = Object.entries(sourceData);

  if (index === 0) {
    // 1. Explicit primary / Devotee 1 match
    for (const [k, v] of entries) {
      if (!v || typeof v === 'boolean') continue;
      const val = String(v).trim();
      if (!val) continue;
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');

      if ([
        'fullname', 'name', 'devoteename', 'devotee', 'primarydevotee',
        'candidatename', 'participantname', 'applicantname', 'devoteefullname',
        'contactperson', 'personname', 'passengername', 'leadername', 'firstname',
        'devotee1name', 'devotee1fullname', 'devotee1', 'member1name', 'member1',
        'person1name', 'person1', 'name1', '1stdevoteename', 'primaryname',
      ].includes(norm)) {
        return val;
      }
    }

    // 2. Generic Name / Devotee column without numbers 2-9
    for (const [k, v] of entries) {
      if (!v || typeof v === 'boolean') continue;
      const val = String(v).trim();
      if (!val) continue;
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (
        (norm.includes('name') || norm.includes('devotee') || norm.includes('candidate') || norm.includes('person') || norm.includes('member')) &&
        !/[2-9]/.test(norm) &&
        !norm.includes('total') &&
        !norm.includes('count') &&
        !norm.includes('number') &&
        !norm.includes('event') &&
        !norm.includes('father') &&
        !norm.includes('mother') &&
        !norm.includes('spouse') &&
        !norm.includes('age') &&
        !norm.includes('gender') &&
        !norm.includes('phone') &&
        !norm.includes('mobile')
      ) {
        return val;
      }
    }

    // 3. Combine First Name & Last Name if present
    const fn = entries.find(([k]) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('firstname'))?.[1];
    const ln = entries.find(([k]) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('lastname'))?.[1];
    if (fn || ln) {
      const combined = `${fn || ''} ${ln || ''}`.trim();
      if (combined) return combined;
    }

    // 4. Fallback: First reasonable non-empty text string
    for (const [k, v] of entries) {
      if (!v || typeof v !== 'string') continue;
      const val = v.trim();
      if (!val) continue;
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
        !norm.includes('age') &&
        !norm.includes('gender') &&
        val.length > 1 &&
        val.length < 60 &&
        !/^\d+$/.test(val)
      ) {
        return val;
      }
    }
  } else {
    // Group members 2, 3, 4 (index 1, 2, 3)
    const n = index + 1; // 2, 3, 4
    const ordinal = n === 2 ? '2nd' : n === 3 ? '3rd' : n === 4 ? '4th' : `${n}th`;

    for (const [k, v] of entries) {
      if (!v || typeof v === 'boolean') continue;
      const val = String(v).trim();
      if (!val) continue;
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');

      const matchesMember =
        norm.includes(`devotee${n}`) ||
        norm.includes(`member${n}`) ||
        norm.includes(`person${n}`) ||
        norm.includes(`name${n}`) ||
        norm.includes(`participant${n}`) ||
        norm.includes(`passenger${n}`) ||
        norm.includes(`guest${n}`) ||
        norm.includes(`${ordinal}devotee`) ||
        norm.includes(`${ordinal}member`) ||
        norm.includes(`${ordinal}person`);

      const isNotMeta =
        !norm.includes('phone') &&
        !norm.includes('mobile') &&
        !norm.includes('age') &&
        !norm.includes('gender') &&
        !norm.includes('id') &&
        !norm.includes('proof');

      if (matchesMember && isNotMeta && val.length > 1) {
        return val;
      }
    }
  }

  return null;
}

/**
 * Robust helper to calculate total devotees (1 to 4+) in a group registration.
 */
export function resolveTotalDevotees(sourceData, systemData) {
  if (Array.isArray(systemData?.devotees) && systemData.devotees.length > 0) {
    return systemData.devotees.length;
  }
  if (!sourceData) return 1;

  const entries = Object.entries(sourceData);

  // 1. Explicit count column in Excel (e.g. "Total Devotees", "Number of Members", "No of Pax", etc.)
  const countEntry = entries.find(([k, v]) => {
    if (v === null || v === undefined || v === '') return false;
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      norm.includes('totaldevotee') ||
      norm.includes('totalmember') ||
      norm.includes('totalperson') ||
      norm.includes('noofdevotee') ||
      norm.includes('numberofdevotee') ||
      norm.includes('noofperson') ||
      norm.includes('noofmember') ||
      norm.includes('devoteecount') ||
      norm.includes('membercount') ||
      norm.includes('totalpax') ||
      norm.includes('paxcount') ||
      norm === 'devotees' ||
      norm === 'members' ||
      norm === 'persons' ||
      norm === 'count'
    );
  });

  if (countEntry && !isNaN(Number(countEntry[1])) && Number(countEntry[1]) > 0) {
    return Math.min(Math.max(1, Math.floor(Number(countEntry[1]))), 10);
  }

  // 2. Detect how many non-empty devotee names exist (check up to 6 members)
  let maxFound = 1;
  for (let i = 2; i <= 6; i++) {
    const hasName = extractDevoteeName(i - 1, sourceData);
    if (hasName) {
      maxFound = i;
    }
  }
  if (maxFound > 1) return maxFound;

  // 3. Detect any numbered column header (e.g., devotee2, member3, person4) with non-empty values
  let maxNumbered = 1;
  for (const [k, v] of entries) {
    if (v === null || v === undefined || String(v).trim() === '') continue;
    const match = k.match(/(?:devotee|person|member|passenger|participant|name|guest)[\s_-]*([2-9]|\d{2})/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxNumbered && num <= 10) maxNumbered = num;
    }
  }
  return maxNumbered;
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

