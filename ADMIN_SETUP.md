# Yatra Seva Portal — Setup & Administration Guide

---

## Table of Contents

1. [First Super Admin Setup](#1-first-super-admin-setup)
2. [Adding Volunteers / Agents](#2-adding-volunteers--agents)
3. [Firestore Security Rules](#3-firestore-security-rules)
4. [Collection Structure Reference](#4-collection-structure-reference)
5. [Demo Credentials](#5-demo-credentials)

---

## 1. First Super Admin Setup

### Why manual setup?

Firebase Authentication credentials must be created in the Firebase Console
or via the Admin SDK on a trusted server. The frontend app **never** creates
admin accounts — that would expose privileged operations to the browser.

### Step 1 — Create the Firebase Auth account

1. Open [Firebase Console](https://console.firebase.google.com/) → project **yatra-seva-3eae2**
2. Go to **Authentication → Users → Add user**
3. Fill in:
   - **Email:** e.g. `admin@yatraseva.local`
   - **Password:** strong password (min 12 characters)
4. Click **Add user**
5. Copy the **User UID** from the users table

### Step 2 — Create the Firestore user profile

1. Go to **Firestore Database → Data**
2. Open (or create) collection: `users`
3. Add document with **Document ID = the UID from Step 1**

| Field       | Type      | Value                    |
|-------------|-----------|--------------------------|
| `uid`       | string    | *(UID from Step 1)*      |
| `name`      | string    | `Demo Admin`             |
| `userId`    | string    | `YATRA-ADM-0001`         |
| `email`     | string    | `admin@yatraseva.local`  |
| `role`      | string    | `SUPER_ADMIN`            |
| `status`    | string    | `ACTIVE`                 |
| `createdAt` | timestamp | *(now)*                  |

> **Never** add a `password` field. Passwords live in Firebase Auth only.

### Step 3 — Verify

1. `npm run dev` → navigate to `/login-page`
2. Sign in with the credentials from Step 1
3. You should land on `/dashboard` with the Super Admin view

---

## 2. Adding Volunteers / Agents

Volunteers are `VERIFICATION_AGENT` role users. Creating them requires two steps
because the browser cannot create Firebase Auth accounts without signing out
the current user.

### Step A — Create Firebase Auth account (Firebase Console)

1. **Authentication → Users → Add user**
2. Enter the volunteer's email and a temporary password
3. Copy the generated **UID**

### Step B — Create Firestore profile (App UI)

1. Log in as Super Admin → go to `/volunteers`
2. Click **+ Add Volunteer**
3. Paste the **UID** from Step A
4. Fill in Name, optional Volunteer ID, Email
5. Click **Create Profile**

The volunteer can now log in and will see only their assigned events.

### Assigning volunteers to events

1. Open any event → `/events/:eventId`
2. Scroll to **Assigned Volunteers**
3. Click **+ Assign Volunteer**, pick from the dropdown, click **Assign**

---

## 3. Firestore Security Rules

Copy the full ruleset below into **Firestore Database → Rules** and click **Publish**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ────────────────────────────────────────────────────────────
    function isSignedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function userRole() {
      return userDoc().role;
    }

    function isSuperAdmin() {
      return isSignedIn() && userRole() == 'SUPER_ADMIN';
    }

    function isAdminOrAbove() {
      return isSignedIn() && userRole() in ['SUPER_ADMIN', 'ADMIN'];
    }

    function isAgent() {
      return isSignedIn() && userRole() == 'VERIFICATION_AGENT';
    }

    function isActiveUser() {
      return isSignedIn() && userDoc().status == 'ACTIVE';
    }

    // Check that a VERIFICATION_AGENT is assigned to the given event
    function isAssignedToEvent(eventId) {
      return isSignedIn() && exists(
        /databases/$(database)/documents/eventAssignments/$(eventId + '_' + request.auth.uid)
      );
    }

    // ── users ──────────────────────────────────────────────────────────────
    match /users/{uid} {
      // Any signed-in user can read their own profile
      allow read: if isSignedIn() && request.auth.uid == uid;

      // Super Admin can read all profiles (for volunteer management UI)
      allow read: if isSuperAdmin();

      // Only Super Admin can create or update profiles (never from agent)
      allow create: if isSuperAdmin();
      allow update: if isSuperAdmin()
        && !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['uid', 'createdAt']);

      // No hard deletes from the frontend
      allow delete: if false;
    }

    // ── events ─────────────────────────────────────────────────────────────
    match /events/{eventId} {
      // Admin/SuperAdmin can read all events
      allow read: if isAdminOrAbove() && isActiveUser();

      // Agents can only read events they are assigned to
      allow read: if isAgent() && isActiveUser() && isAssignedToEvent(eventId);

      // Only Super Admin can create/update events
      allow create: if isSuperAdmin() && isActiveUser();
      allow update: if isSuperAdmin() && isActiveUser()
        && !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['createdBy', 'createdAt']);

      allow delete: if false;

      // ── registrations sub-collection ─────────────────────────────────────
      match /registrations/{registrationId} {
        // Admin/SuperAdmin: full read
        allow read: if isAdminOrAbove() && isActiveUser();

        // Agents: read only if assigned to the event
        allow read: if isAgent() && isActiveUser() && isAssignedToEvent(eventId);

        // Only Super Admin can bulk-import (create)
        allow create: if isSuperAdmin() && isActiveUser();

        // Super Admin: any update
        // Agent: can ONLY update verification-related fields on PENDING records
        allow update: if isSuperAdmin() && isActiveUser();
        allow update: if isAgent() && isActiveUser()
          && isAssignedToEvent(eventId)
          && resource.data.status == 'PENDING'
          && request.resource.data.diff(resource.data).affectedKeys()
              .hasOnly(['devotees', 'status', 'verifiedBy', 'verifiedAt',
                        'goodieKitIssued', 'goodieKitIssuedBy', 'goodieKitIssuedAt']);

        allow delete: if false;
      }
    }

    // ── eventAssignments ───────────────────────────────────────────────────
    match /eventAssignments/{assignmentId} {
      // Super Admin: full read/write
      allow read, write: if isSuperAdmin() && isActiveUser();

      // Agent: can read their own assignments (for dashboard event list)
      allow read: if isAgent() && isActiveUser()
        && resource.data.volunteerUid == request.auth.uid;
    }

    // ── verificationLogs ───────────────────────────────────────────────────
    // Immutable audit trail — create only, no updates or deletes
    match /verificationLogs/{logId} {
      allow read:   if isAdminOrAbove() && isActiveUser();
      allow read:   if isAgent() && isActiveUser()
                       && resource.data.performedBy == request.auth.uid;
      allow create: if isSignedIn() && isActiveUser();
      allow update: if false;   // immutable
      allow delete: if false;   // immutable
    }

    // ── deny everything else ───────────────────────────────────────────────
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> **Important:** The `userDoc()` / `userRole()` helpers perform a cross-document
> read on every rules evaluation. This is fine for low-traffic admin tools.
> For high-volume production apps, migrate to **Firebase Custom Claims** to
> avoid the extra read cost.

---

## 4. Collection Structure Reference

```
Firestore
├── users/
│   └── {uid}                    ← UserProfile (role, status, etc.)
│
├── events/
│   └── {eventId}                ← YatraEvent
│       └── registrations/
│           └── {registrationId} ← Registration + Devotees[]
│
├── eventAssignments/
│   └── {eventId}_{volunteerUid} ← EventAssignment (deterministic ID)
│
└── verificationLogs/
    └── {logId}                  ← VerificationLog (immutable)
```

### Field notes

**Registration document** — verification fields added per devotee:
```json
{
  "devotees": [
    {
      "fullName": "...",
      "verificationStatus": "PENDING | VERIFIED",
      "verifiedBy": "uid",
      "verifiedAt": "Timestamp"
    }
  ],
  "status": "PENDING | VERIFIED | CANCELLED",
  "goodieKitIssued": false,
  "goodieKitIssuedBy": "uid",
  "goodieKitIssuedAt": "Timestamp"
}
```

**EventAssignment** — document ID is `{eventId}_{volunteerUid}` for natural
deduplication and O(1) existence checks in security rules.

---

## 5. Demo Credentials

> Remove this section before production deployment.

| Field    | Value                   |
|----------|-------------------------|
| Email    | `admin@yatraseva.local` |
| Password | *(set by you in Step 1)*|
