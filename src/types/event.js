/**
 * Event domain types
 *
 * @typedef {'UPCOMING' | 'ACTIVE' | 'COMPLETED'} EventStatus
 *
 * @typedef {Object} YatraEvent
 * @property {string}      id                  - Firestore document ID
 * @property {string}      name                - Event / Yatra name
 * @property {import('firebase/firestore').Timestamp} startDate  - First day of event
 * @property {import('firebase/firestore').Timestamp} endDate    - Last day of event (= startDate for single-day)
 * @property {boolean}     isSingleDay         - true when startDate === endDate
 * @property {import('firebase/firestore').Timestamp} [date]     - LEGACY field on old documents; use startDate on new ones
 * @property {string}      location
 * @property {string}      description
 * @property {EventStatus} status              - Auto-computed from startDate/endDate; synced on load
 * @property {string}      createdBy           - Firebase Auth UID
 * @property {string|null} [qrIdentifierColumn] - Excel column name used as QR identifier for this event
 * @property {import('firebase/firestore').Timestamp} createdAt
 * @property {import('firebase/firestore').Timestamp} updatedAt
 */

/** Allowed event statuses */
export const EVENT_STATUSES = /** @type {const} */ ({
  UPCOMING:  'UPCOMING',
  ACTIVE:    'ACTIVE',
  COMPLETED: 'COMPLETED',
});

/** Human-readable labels for each status */
export const EVENT_STATUS_LABELS = {
  UPCOMING:  'Upcoming',
  ACTIVE:    'Active',
  COMPLETED: 'Completed',
};

/** Tailwind colour classes for status badges */
export const EVENT_STATUS_STYLES = {
  UPCOMING:  { bg: 'bg-sky-100',     text: 'text-sky-800',     border: 'border-sky-200'     },
  ACTIVE:    { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  COMPLETED: { bg: 'bg-stone-100',   text: 'text-stone-600',   border: 'border-stone-200'   },
};
