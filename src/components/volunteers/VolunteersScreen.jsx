/**
 * VolunteersScreen — /volunteers
 *
 * Lists all Verification Agent profiles from Firestore.
 * Super Admin can:
 *  - View volunteers with role, status, and assigned event count
 *  - Add a new volunteer profile (Firestore doc only — Auth account created manually)
 *  - Toggle volunteer status (ACTIVE / SUSPENDED)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, User, Mail, Hash, ShieldCheck,
  Loader2, AlertCircle, UsersRound, X, Check,
  ToggleLeft, ToggleRight, Info,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
  getVolunteers,
  createVolunteerProfile,
  updateVolunteerStatus,
} from '../../services/volunteerService';
import { getAssignmentsForUser } from '../../services/assignmentService';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_ROLE_STYLES,
  USER_STATUSES,
  USER_STATUS_STYLES,
} from '../../types/user';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const s = USER_ROLE_STYLES[role] ?? USER_ROLE_STYLES.VERIFICATION_AGENT;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {USER_ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusDot({ status }) {
  const s = USER_STATUS_STYLES[status] ?? USER_STATUS_STYLES.INACTIVE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === USER_STATUSES.ACTIVE ? 'bg-emerald-600' : 'bg-stone-400'}`} />
      {status}
    </span>
  );
}

// ─── Add Volunteer Modal ──────────────────────────────────────────────────────

function AddVolunteerModal({ onAdded, onClose, creatorUid }) {
  const [form, setForm]     = useState({ uid: '', name: '', userId: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (f) => (e) => { setForm((p) => ({ ...p, [f]: e.target.value })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.uid.trim())   return setError('Firebase Auth UID is required.');
    if (!form.name.trim())  return setError('Full name is required.');
    if (!form.email.trim()) return setError('Email is required.');

    setSaving(true);
    try {
      await createVolunteerProfile({
        uid:       form.uid.trim(),
        name:      form.name.trim(),
        userId:    form.userId.trim(),
        email:     form.email.trim(),
        role:      USER_ROLES.VERIFICATION_AGENT,
        createdBy: creatorUid,
      });
      onAdded();
    } catch (err) {
      console.error('[AddVolunteer]', err);
      setError(err.message || 'Failed to create volunteer profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full h-11 px-3.5 text-[14px] bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all';
  const labelCls = 'block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAF7F2] font-['Poppins',sans-serif]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-stone-200/70 bg-white shrink-0">
        <div>
          <h2 className="text-[17px] font-bold text-stone-900">Add Verification Agent</h2>
          <p className="text-[12px] text-stone-500 mt-0.5">Creates the Firestore profile</p>
        </div>
        <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Auth creation notice */}
      <div className="px-6 pt-5">
        <div className="max-w-lg mx-auto flex items-start gap-3 p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
          <div className="text-[12px] leading-relaxed">
            <span className="font-semibold block mb-1">Firebase Auth account must be created first.</span>
            Go to <strong>Firebase Console → Authentication → Add user</strong>, create the account,
            then paste the generated <strong>UID</strong> below. This form only creates the Firestore profile.
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-lg mx-auto">
          <form id="add-volunteer-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div>
              <label className={labelCls}>Firebase Auth UID *</label>
              <input type="text" value={form.uid} onChange={set('uid')} placeholder="e.g. abc123XYZ..." className={inputCls} autoFocus />
              <p className="text-[11px] text-stone-400 mt-1">Found in Firebase Console → Authentication → Users table</p>
            </div>

            <div>
              <label className={labelCls}>Full Name *</label>
              <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Navadeep Das" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Volunteer ID</label>
                <input type="text" value={form.userId} onChange={set('userId')} placeholder="e.g. VOL-1024" className={inputCls} />
                <p className="text-[11px] text-stone-400 mt-1">Auto-generated if blank</p>
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="agent@yatra.local" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Role</label>
              <div className="h-11 px-3.5 flex items-center bg-amber-50 border border-amber-200 rounded-xl text-[13px] font-semibold text-amber-800">
                Verification Agent
              </div>
              <p className="text-[11px] text-stone-400 mt-1">Only Verification Agents can be added here. Super Admins are created via ADMIN_SETUP.md.</p>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-6 py-4 bg-white border-t border-stone-200/70">
        <div className="max-w-lg mx-auto flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 h-12 rounded-2xl border border-stone-200 text-stone-600 text-[14px] font-medium hover:bg-stone-50 cursor-pointer">Cancel</button>
          <button type="submit" form="add-volunteer-form" disabled={saving} className="flex-[2] h-12 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer shadow-md shadow-amber-900/20">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /><span>Create Profile</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Volunteer Card ───────────────────────────────────────────────────────────

function VolunteerCard({ volunteer, assignmentCount, onToggleStatus, toggling }) {
  const isActive = volunteer.status === USER_STATUSES.ACTIVE;

  return (
    <div className="bg-white border border-stone-200/80 rounded-2xl p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-stone-900 leading-tight">{volunteer.name}</p>
            <p className="text-[12px] font-mono text-stone-500">{volunteer.userId}</p>
          </div>
        </div>
        <button
          onClick={() => onToggleStatus(volunteer.uid, isActive ? USER_STATUSES.SUSPENDED : USER_STATUSES.ACTIVE)}
          disabled={toggling === volunteer.uid}
          className="shrink-0 text-stone-400 hover:text-stone-700 cursor-pointer disabled:opacity-50 transition-colors"
          aria-label={isActive ? 'Suspend volunteer' : 'Activate volunteer'}
          title={isActive ? 'Suspend' : 'Activate'}
        >
          {toggling === volunteer.uid
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : isActive
              ? <ToggleRight className="w-5 h-5 text-emerald-600" />
              : <ToggleLeft className="w-5 h-5 text-stone-400" />
          }
        </button>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 text-[12px] text-stone-500">
        <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
        <span className="truncate">{volunteer.email}</span>
      </div>

      {/* Badges + assignments */}
      <div className="flex items-center justify-between pt-2 border-t border-stone-100">
        <div className="flex items-center gap-2">
          <RoleBadge role={volunteer.role} />
          <StatusDot status={volunteer.status} />
        </div>
        <div className="flex items-center gap-1 text-[12px] text-stone-500">
          <Hash className="w-3.5 h-3.5" />
          <span className="font-semibold text-stone-700">{assignmentCount}</span>
          <span>event{assignmentCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function VolunteersScreen() {
  const navigate         = useNavigate();
  const { firebaseUser } = useAuth();

  const [volunteers, setVolunteers]       = useState([]);
  const [assignmentCounts, setCounts]     = useState({}); // uid → count
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [showModal, setModal]             = useState(false);
  const [successMsg, setSuccess]          = useState('');
  const [toggling, setToggling]           = useState(null); // uid being toggled

  const loadVolunteers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getVolunteers();
      setVolunteers(data);

      // Load assignment counts in parallel
      const counts = {};
      await Promise.all(data.map(async (v) => {
        try {
          const assignments = await getAssignmentsForUser(v.uid);
          counts[v.uid] = assignments.length;
        } catch {
          counts[v.uid] = 0;
        }
      }));
      setCounts(counts);
    } catch (err) {
      console.error('[VolunteersScreen]', err);
      setError('Unable to load volunteers. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVolunteers(); }, [loadVolunteers]);

  const handleAdded = () => {
    setModal(false);
    setSuccess('Volunteer profile created.');
    setTimeout(() => setSuccess(''), 4000);
    loadVolunteers();
  };

  const handleToggleStatus = async (uid, newStatus) => {
    setToggling(uid);
    try {
      await updateVolunteerStatus(uid, newStatus);
      setVolunteers((prev) => prev.map((v) => v.uid === uid ? { ...v, status: newStatus } : v));
    } catch (err) {
      console.error('[toggleStatus]', err);
    } finally {
      setToggling(null);
    }
  };

  return (
    <>
      {showModal && (
        <AddVolunteerModal
          onAdded={handleAdded}
          onClose={() => setModal(false)}
          creatorUid={firebaseUser?.uid}
        />
      )}

      <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F3ECE0] text-stone-800 select-none font-['Poppins',sans-serif]">

        {/* Header */}
        <header className="shrink-0 pt-4 px-5 pb-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-white border border-stone-200 shadow-xs flex items-center justify-center text-stone-600 hover:text-amber-800 active:scale-95 transition-all cursor-pointer shrink-0" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-bold text-stone-900 leading-tight">Volunteers</h1>
            <p className="text-[12px] text-stone-500">Verification agents &amp; assignments</p>
          </div>
          <button onClick={() => setModal(true)} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-[12px] font-semibold shadow-sm cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Volunteer</span>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-10">
          <div className="max-w-lg mx-auto space-y-3 pt-1">

            {successMsg && (
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />{successMsg}
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-600" />
                  <span className="text-[12px] text-stone-400 font-medium">Loading volunteers…</span>
                </div>
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-[13px] text-stone-600">{error}</p>
                <button onClick={loadVolunteers} className="px-5 h-9 rounded-xl bg-stone-900 text-white text-[12px] font-semibold cursor-pointer">Retry</button>
              </div>
            )}

            {!loading && !error && volunteers.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <UsersRound className="w-8 h-8 text-amber-400" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-stone-800">No volunteers yet</p>
                  <p className="text-[12px] text-stone-500 mt-1 max-w-[220px]">Add your first verification agent to get started.</p>
                </div>
                <button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 px-5 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-semibold cursor-pointer">
                  <Plus className="w-4 h-4" />Add First Volunteer
                </button>
              </div>
            )}

            {!loading && !error && volunteers.length > 0 && (
              <>
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-1">
                  {volunteers.length} agent{volunteers.length !== 1 ? 's' : ''}
                </p>
                {volunteers.map((v) => (
                  <VolunteerCard
                    key={v.uid}
                    volunteer={v}
                    assignmentCount={assignmentCounts[v.uid] ?? 0}
                    onToggleStatus={handleToggleStatus}
                    toggling={toggling}
                  />
                ))}
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
