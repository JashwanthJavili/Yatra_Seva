/**
 * User domain types
 *
 * @typedef {'SUPER_ADMIN' | 'ADMIN' | 'VERIFICATION_AGENT'} UserRole
 *
 * @typedef {'ACTIVE' | 'INACTIVE' | 'SUSPENDED'} UserStatus
 *
 * @typedef {Object} UserProfile
 * @property {string}      uid        - Firebase Auth UID (document key in Firestore)
 * @property {string}      name       - Display name, e.g. "Navadeep"
 * @property {string}      userId     - Human-readable ID, e.g. "VOL-1024"
 * @property {string}      email      - Email address (mirrors Firebase Auth email)
 * @property {UserRole}    role       - Access role
 * @property {UserStatus}  status     - Account status
 * @property {import('firebase/firestore').Timestamp} createdAt
 * @property {string}      [createdBy] - UID of the admin who created this profile
 */

/** Allowed role values */
export const USER_ROLES = /** @type {const} */ ({
  SUPER_ADMIN:        'SUPER_ADMIN',
  ADMIN:              'ADMIN',
  VERIFICATION_AGENT: 'VERIFICATION_AGENT',
});

/** Human-readable labels for each role */
export const USER_ROLE_LABELS = {
  SUPER_ADMIN:        'Super Admin',
  ADMIN:              'Admin',
  VERIFICATION_AGENT: 'Verification Agent',
};

/** Tailwind colour classes for role badges */
export const USER_ROLE_STYLES = {
  SUPER_ADMIN:        { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
  ADMIN:              { bg: 'bg-sky-100',    text: 'text-sky-800',    border: 'border-sky-200'    },
  VERIFICATION_AGENT: { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-200'  },
};

/** Allowed status values */
export const USER_STATUSES = /** @type {const} */ ({
  ACTIVE:    'ACTIVE',
  INACTIVE:  'INACTIVE',
  SUSPENDED: 'SUSPENDED',
});

export const USER_STATUS_STYLES = {
  ACTIVE:    { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  INACTIVE:  { bg: 'bg-stone-100',   text: 'text-stone-600',   border: 'border-stone-200'   },
  SUSPENDED: { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-200'     },
};

/** Roles that count as administrative (can manage events) */
export const ADMIN_ROLES = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];
