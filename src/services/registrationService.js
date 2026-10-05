/**
 * registrationService.js — Firestore persistence for dynamic registrations.
 *
 * ARCHITECTURE:
 *  Every Firestore document has exactly two top-level fields:
 *    sourceData  — the raw Excel row (Record<string, unknown>), untouched
 *    systemData  — application metadata only
 *
 *  The document ID is derived from the QR identifier column value.
 *  No Excel field names are assumed or hard-coded here.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  query,
  limit,
} from 'firebase/firestore';
import db from '../firebase/firestore';
import { REGISTRATION_STATUS } from '../types/registration';

const BATCH_LIMIT = 500;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sub-collection reference */
function regCol(eventId) {
  return collection(db, 'events', eventId, 'registrations');
}

/**
 * Derive a Firestore-safe document ID from an arbitrary identifier value.
 * Firestore doc IDs cannot contain '/' and have a 1500-byte limit.
 *
 * @param {unknown} identifierValue
 * @returns {string}
 */
function deriveDocId(identifierValue) {
  const raw = String(identifierValue ?? '').trim();
  if (!raw) throw new Error('Cannot derive document ID from empty identifier.');
  // Replace unsafe characters, uppercase, cap at 1200 chars (safe margin)
  return raw.replace(/[^a-zA-Z0-9_\-\.]/g, '_').toUpperCase().slice(0, 1200);
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ImportResult
 * @property {number}   attempted
 * @property {number}   imported        - new documents created
 * @property {number}   updated         - existing PENDING documents refreshed
 * @property {number}   skippedVerified - existing VERIFIED documents left untouched
 * @property {number}   errors
 * @property {string[]} errorMessages
 */

/**
 * Write valid rows into Firestore using sourceData/systemData structure.
 *
 * @param {string}   eventId
 * @param {string}   qrIdentifierColumn   - which sourceData key is the QR identifier
 * @param {Array<import('../types/registration').SourceData>} validSourceRows
 * @param {string}   importedByUid
 * @returns {Promise<ImportResult>}
 */
export async function importRegistrations(eventId, qrIdentifierColumn, validSourceRows, importedByUid) {
  const result = {
    attempted:       validSourceRows.length,
    imported:        0,
    updated:         0,
    skippedVerified: 0,
    errors:          0,
    errorMessages:   [],
  };

  if (validSourceRows.length === 0) return result;

  // ── 1. Pre-fetch all existing docs ────────────────────────────────────────
  const existingSnap   = await getDocs(regCol(eventId));
  const existingByDocId = new Map();
  existingSnap.forEach((d) => existingByDocId.set(d.id, d.data()));

  // ── 2. Classify ───────────────────────────────────────────────────────────
  const toCreate = [];
  const toUpdate = [];

  for (const sourceData of validSourceRows) {
    const idValue = sourceData[qrIdentifierColumn];
    let docId;
    try {
      docId = deriveDocId(idValue);
    } catch (err) {
      result.errors++;
      result.errorMessages.push(`Skipped row — ${err.message}`);
      continue;
    }

    if (existingByDocId.has(docId)) {
      const existing = existingByDocId.get(docId);
      if (existing?.systemData?.status === REGISTRATION_STATUS.VERIFIED) {
        result.skippedVerified++;
        continue;
      }
      toUpdate.push({ docId, sourceData });
    } else {
      toCreate.push({ docId, sourceData });
    }
  }

  // ── 3. Build write payloads ───────────────────────────────────────────────
  const ts = serverTimestamp();

  const allWrites = [
    ...toCreate.map(({ docId, sourceData }) => ({
      ref:   doc(regCol(eventId), docId),
      data: {
        sourceData,
        systemData: {
          docId,
          eventId,
          status:              REGISTRATION_STATUS.PENDING,
          goodieKitIssued:     false,
          qrIdentifierColumn,
          qrIdentifierValue:   String(sourceData[qrIdentifierColumn] ?? '').trim(),
          importedBy:          importedByUid,
          importedAt:          ts,
        },
      },
      isNew: true,
    })),
    ...toUpdate.map(({ docId, sourceData }) => ({
      ref:  doc(regCol(eventId), docId),
      data: {
        // Refresh sourceData with latest Excel content
        sourceData,
        // Patch only non-verification systemData fields
        'systemData.qrIdentifierColumn': qrIdentifierColumn,
        'systemData.qrIdentifierValue':  String(sourceData[qrIdentifierColumn] ?? '').trim(),
        'systemData.importedBy':         importedByUid,
        'systemData.updatedAt':          ts,
      },
      isNew: false,
    })),
  ];

  // ── 4. Batched writes ─────────────────────────────────────────────────────
  for (let i = 0; i < allWrites.length; i += BATCH_LIMIT) {
    const chunk = allWrites.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const { ref, data, isNew } of chunk) {
      if (isNew) batch.set(ref, data);
      else       batch.update(ref, data);
    }

    try {
      await batch.commit();
      for (const { isNew } of chunk) {
        if (isNew) result.imported++;
        else       result.updated++;
      }
    } catch (err) {
      result.errors += chunk.length;
      result.errorMessages.push(`Batch ${Math.floor(i / BATCH_LIMIT) + 1} failed: ${err.message}`);
    }
  }

  return result;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RegistrationStats
 * @property {number} total
 * @property {number} verified
 * @property {number} pending
 * @property {number} cancelled
 * @property {number} goodiesIssued
 */

/**
 * @param {string} eventId
 * @returns {Promise<RegistrationStats>}
 */
export async function getRegistrationStats(eventId) {
  const snap = await getDocs(regCol(eventId));
  let total = 0, verified = 0, pending = 0, cancelled = 0, goodiesIssued = 0;

  snap.forEach((d) => {
    const sys = d.data()?.systemData ?? {};
    total++;
    if (sys.status === REGISTRATION_STATUS.VERIFIED)  verified++;
    if (sys.status === REGISTRATION_STATUS.PENDING)   pending++;
    if (sys.status === REGISTRATION_STATUS.CANCELLED) cancelled++;
    if (sys.goodieKitIssued) goodiesIssued++;
  });

  return { total, verified, pending, cancelled, goodiesIssued };
}

/**
 * Fetch a page of registrations.
 * @param {string} eventId
 * @param {number} [pageSize]
 * @returns {Promise<import('../types/registration').RegistrationDoc[]>}
 */
export async function getRegistrations(eventId, pageSize = 100) {
  const q    = query(regCol(eventId), limit(pageSize));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), _id: d.id }));
}

/**
 * Fetch a single registration by its document ID (= sanitised QR value).
 * @param {string} eventId
 * @param {string} docId
 * @returns {Promise<import('../types/registration').RegistrationDoc | null>}
 */
export async function getRegistrationById(eventId, docId) {
  const snap = await getDoc(doc(regCol(eventId), docId));
  if (!snap.exists()) return null;
  return { ...snap.data(), _id: snap.id };
}

/**
 * Fetch a registration by its raw QR identifier value.
 * Derives the doc ID and does a direct get (O(1)).
 *
 * @param {string} eventId
 * @param {unknown} qrIdentifierValue
 * @returns {Promise<import('../types/registration').RegistrationDoc | null>}
 */
export async function getRegistrationByQrValue(eventId, qrIdentifierValue) {
  try {
    const docId = deriveDocId(qrIdentifierValue);
    return await getRegistrationById(eventId, docId);
  } catch {
    return null;
  }
}

/**
 * Export deriveDocId so the scan screen can compute the doc ID
 * client-side without an extra Firestore read.
 *
 * @param {unknown} identifierValue
 * @returns {string}
 */
export function deriveDocIdPublic(identifierValue) {
  return deriveDocId(identifierValue);
}

/**
 * Attach a real-time listener to a single registration document.
 * Re-exported here so components only need to import from one service.
 *
 * @param {string} eventId
 * @param {string} docId
 * @param {(data: import('../types/registration').RegistrationDoc | null) => void} onData
 * @param {(err: Error) => void} onError
 * @returns {() => void} unsubscribe
 */
export function watchRegistration(eventId, docId, onData, onError) {
  return onSnapshot(
    doc(collection(db, 'events', eventId, 'registrations'), docId),
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      onData({ ...snap.data(), _id: snap.id });
    },
    onError,
  );
}
