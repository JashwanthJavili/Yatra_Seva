/**
 * Registration domain types — DYNAMIC SCHEMA ARCHITECTURE
 *
 * Every registration document in Firestore has two distinct namespaces:
 *
 *   sourceData  — exactly what came from the Excel file, no additions,
 *                 no removals, no type coercion beyond safe Excel handling.
 *                 Keys are the original Excel column headers.
 *
 *   systemData  — application-managed fields only. Never mixed into sourceData.
 *
 * There is intentionally NO fixed interface for sourceData because different
 * events use completely different Excel schemas.
 *
 * @typedef {Record<string, unknown>} SourceData
 * Raw Excel row data — keys are original column header names, values are
 * whatever Excel contained (string, number, boolean, date string).
 *
 * @typedef {'PENDING' | 'VERIFIED' | 'CANCELLED'} RegistrationStatus
 *
 * @typedef {Object} SystemData
 * @property {string}             docId          - Firestore document ID (= sanitised QR identifier value)
 * @property {string}             eventId
 * @property {RegistrationStatus} status
 * @property {boolean}            goodieKitIssued
 * @property {string}             qrIdentifierColumn - which sourceData key is the QR identifier
 * @property {string}             qrIdentifierValue  - the actual value from that column (for quick lookup)
 * @property {string}             importedBy
 * @property {import('firebase/firestore').Timestamp} importedAt
 * @property {import('firebase/firestore').Timestamp} [updatedAt]
 * @property {string}             [verifiedBy]
 * @property {import('firebase/firestore').Timestamp} [verifiedAt]
 * @property {string}             [goodieKitIssuedBy]
 * @property {import('firebase/firestore').Timestamp} [goodieKitIssuedAt]
 *
 * @typedef {Object} RegistrationDoc
 * @property {SourceData} sourceData
 * @property {SystemData} systemData
 *
 * @typedef {Object} ParsedRow
 * @property {number}                rowIndex   - 1-based (accounting for header row)
 * @property {'valid'|'invalid'|'duplicate'} state
 * @property {string[]}              errors
 * @property {SourceData|null}       sourceData - null when state !== 'valid'
 * @property {Record<string,unknown>} rawData   - original xlsx row object
 */

export const REGISTRATION_STATUS = /** @type {const} */ ({
  PENDING:   'PENDING',
  VERIFIED:  'VERIFIED',
  CANCELLED: 'CANCELLED',
});
