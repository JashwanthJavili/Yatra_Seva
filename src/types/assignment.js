/**
 * Assignment and verification audit types
 *
 * @typedef {'ACTIVE' | 'REMOVED'} AssignmentStatus
 *
 * @typedef {Object} EventAssignment
 * @property {string}           id           - Firestore document ID
 * @property {string}           eventId      - Target event
 * @property {string}           volunteerUid - Firebase Auth UID of the assigned volunteer
 * @property {string}           volunteerUserId - Human-readable ID (e.g. "VOL-1024"), denormalised for display
 * @property {string}           volunteerName   - Display name, denormalised for display
 * @property {string}           assignedBy   - UID of the SUPER_ADMIN who created this assignment
 * @property {import('firebase/firestore').Timestamp} assignedAt
 * @property {AssignmentStatus} status
 *
 * @typedef {'VERIFIED' | 'UNVERIFIED' | 'GOODIE_ISSUED' | 'NOTE_ADDED'} VerificationAction
 *
 * @typedef {Object} VerificationLog
 * @property {string}             id
 * @property {string}             eventId
 * @property {string}             registrationId
 * @property {string}             devoteeIndex   - "0" for primary, "1","2","3" for dependents
 * @property {VerificationAction} action
 * @property {string}             performedBy    - Firebase Auth UID
 * @property {string}             performedByName
 * @property {import('firebase/firestore').Timestamp} performedAt
 * @property {string}             [note]
 */

export const ASSIGNMENT_STATUS = /** @type {const} */ ({
  ACTIVE:  'ACTIVE',
  REMOVED: 'REMOVED',
});

export const VERIFICATION_ACTIONS = /** @type {const} */ ({
  VERIFIED:      'VERIFIED',
  UNVERIFIED:    'UNVERIFIED',
  GOODIE_ISSUED: 'GOODIE_ISSUED',
  NOTE_ADDED:    'NOTE_ADDED',
});
