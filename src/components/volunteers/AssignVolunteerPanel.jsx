/**
 * AssignVolunteerPanel
 *
 * Embedded inside EventDetailScreen.
 * Shows active assignments for an event and allows Super Admin to
 * add or remove volunteers via a searchable full-screen picker modal.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, UserMinus, Users, Loader2, AlertCircle,
  Search, X, Check, ChevronRight, Gift,
} from 'lucide-react';
import { getVolunteers } from '../../services/volunteerService';
import {
  getAssignmentsForEvent,
  assignVolunteer,
  removeAssignment,
} from '../../services/assignmentService';
import { getEventVerificationStatsByVolunteer } from '../../services/verificationService';
import { USER_STATUSES } from '../../types/user';

// ─── Volunteer Picker Modal ───────────────────────────────────────────────────

function VolunteerPickerModal({ eventId, existingUids, assignedBy, onAssigned, onClose }) {
  const [volunteers, setVolunteers] = useState([]);
  const [loaded, setLoaded]         = useState(false);
  const [query, setQuery]           = useState('');
  const [assigning, setAssigning]   = useState(null); // uid being assigned
  const [error, setError]           = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    getVolunteers()
      .then((v) => { setVolunteers(v); setLoaded(true); })
      .catch(() => { setLoaded(true); });
    // auto-focus search after mount
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  const available = volunteers.filter(
    (v) => !existingUids.has(v.uid) && v.status === USER_STATUSES.ACTIVE,
  );

  const filtered = query.trim()
    ? available.filter(
        (v) =>
          v.name.toLowerCase().includes(query.toLowerCase()) ||
          v.userId.toLowerCase().includes(query.toLowerCase()),
      )
    : available;

  const handleAssign = async (vol) => {
    setAssigning(vol.uid);
    setError('');
    try {
      await assignVolunteer({
        eventId,
        volunteerUid:    vol.uid,
        volunteerName:   vol.name,
        volunteerUserId: vol.userId,
        assignedBy,
      });
      onAssigned();
    } catch (err) {
      console.error('[AssignVolunteer]', err);
      setError('Failed to assign. Please try again.');
    } finally {
      setAssigning(null);
    }
  };

  // Initials avatar colour from name
  function avatarColour(name = '') {
    const colours = [
      'bg-violet-100 text-violet-700',
      'bg-sky-100 text-sky-700',
      'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700',
      'bg-teal-100 text-teal-700',
      'bg-indigo-100 text-indigo-700',
    ];
    const idx = name.charCodeAt(0) % colours.length;
    return colours[idx];
  }

  function initials(name = '') {
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAF7F2] font-['Poppins',sans-serif]">

      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-stone-200/70 bg-white shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors cursor-pointer shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-[16px] font-bold text-stone-900">Assign Volunteer</h2>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {loaded ? `${available.length} agent${available.length !== 1 ? 's' : ''} available` : 'Loading…'}
          </p>
        </div>
      </header>

      {/* Search bar */}
      <div className="px-5 py-3 bg-white border-b border-stone-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or ID…"
            className="w-full h-11 pl-9 pr-4 text-[14px] bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px] mb-2">
            <AlertCircle className="w-4 h-4 shrink-0" /><span className="font-medium">{error}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {!loaded && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] rounded-2xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* No agents in system */}
        {loaded && volunteers.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
              <Users className="w-8 h-8 text-stone-300" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-stone-700">No agents added yet</p>
              <p className="text-[12px] text-stone-400 mt-1">Add agents from the Volunteers page first.</p>
            </div>
            <a
              href="/volunteers"
              className="inline-flex items-center gap-2 px-5 h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add New Agent
            </a>
          </div>
        )}

        {/* All assigned */}
        {loaded && volunteers.length > 0 && available.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-stone-700">All agents assigned</p>
              <p className="text-[12px] text-stone-400 mt-1">Every active volunteer is already assigned to this event.</p>
            </div>
            <a
              href="/volunteers"
              className="inline-flex items-center gap-2 px-5 h-11 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add New Agent
            </a>
          </div>
        )}

        {/* No search results */}
        {loaded && available.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Search className="w-7 h-7 text-stone-300" />
            <p className="text-[13px] text-stone-500">No agents match <strong>"{query}"</strong></p>
          </div>
        )}

        {/* Volunteer cards */}
        {filtered.map((vol) => {
          const busy = assigning === vol.uid;
          return (
            <button
              key={vol.uid}
              onClick={() => !assigning && handleAssign(vol)}
              disabled={!!assigning}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border border-stone-200/80 hover:border-amber-300 hover:shadow-sm active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer group text-left"
            >
              {/* Avatar */}
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-[14px] font-bold shrink-0 ${avatarColour(vol.name)}`}>
                {busy
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : initials(vol.name)
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-stone-900 truncate">{vol.name}</p>
                <p className="text-[11px] font-mono text-stone-400">{vol.userId}</p>
              </div>

              {/* Arrow / spinner */}
              {busy
                ? null
                : <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-500 shrink-0 transition-colors" />
              }
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Verified Devotees Modal (SUPER ADMIN ONLY) ───────────────────────────────

function VerifiedDevoteesModal({ eventId, volunteer, stats, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const devotees = stats?.devotees ?? [];

  const filtered = query.trim()
    ? devotees.filter((d) =>
        (d.devoteeName || '').toLowerCase().includes(query.toLowerCase()) ||
        (d.registrationId || '').toLowerCase().includes(query.toLowerCase()),
      )
    : devotees;

  function formatTime(ts) {
    if (!ts) return '—';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAF7F2] font-['Poppins',sans-serif]">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-stone-200/70 bg-white shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors cursor-pointer shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-stone-900 truncate">
              {volunteer.volunteerName}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold shrink-0">
              {devotees.length} Verified
            </span>
          </div>
          <p className="text-[11px] text-stone-400 font-mono mt-0.5">{volunteer.volunteerUserId}</p>
        </div>
      </header>

      {/* Search filter */}
      <div className="px-5 py-3 bg-white border-b border-stone-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by devotee name or ID…"
            className="w-full h-11 pl-9 pr-4 text-[14px] bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Devotees list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {devotees.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Gift className="w-8 h-8 text-stone-300" />
            <p className="text-[14px] font-semibold text-stone-600">No devotees verified yet</p>
            <p className="text-[12px] text-stone-400">Verifications recorded by this agent will appear here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-stone-500">
            No devotees match <strong>"{query}"</strong>
          </div>
        ) : (
          filtered.map((d, i) => (
            <div
              key={d.id || i}
              onClick={() => {
                if (d.registrationId && d.registrationId !== '—') {
                  navigate(`/registration/${encodeURIComponent(d.registrationId)}?eventId=${eventId}`);
                }
              }}
              className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-stone-200/80 hover:border-amber-300 hover:shadow-xs active:scale-[0.99] transition-all cursor-pointer group select-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-[13px] shrink-0">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-stone-900 group-hover:text-amber-800 transition-colors truncate leading-tight">
                    {d.devoteeName}
                  </p>
                  <p className="text-[11px] font-mono text-stone-400 mt-0.5">
                    {d.registrationId} • {formatTime(d.performedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Verified
                </span>
                <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-500 transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Assigned volunteer chip ───────────────────────────────────────────────────

function AssignmentChip({ assignment, stats, onViewDevotees, onRemove, removing }) {
  const isBusy = removing === assignment.id;
  const count  = stats?.count ?? 0;

  function avatarColour(name = '') {
    const colours = [
      'bg-violet-100 text-violet-700',
      'bg-sky-100 text-sky-700',
      'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700',
      'bg-teal-100 text-teal-700',
      'bg-indigo-100 text-indigo-700',
    ];
    return colours[name.charCodeAt(0) % colours.length];
  }

  function initials(name = '') {
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-stone-200/80 group">
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0 ${avatarColour(assignment.volunteerName)}`}>
        {initials(assignment.volunteerName)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-stone-900 truncate leading-tight">{assignment.volunteerName}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] font-mono text-stone-400">{assignment.volunteerUserId}</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active
          </span>

          {/* Verification count badge (with clickable devotee list for Super Admin) */}
          {count > 0 ? (
            <button
              onClick={() => onViewDevotees(assignment, stats)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
              title="Click to view verified devotees"
            >
              <Gift className="w-3 h-3 text-emerald-600" />
              <span>{count} Verified</span>
              <ChevronRight className="w-3 h-3 text-emerald-500 ml-0.5" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-stone-400 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-full">
              0 Verified
            </span>
          )}
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(assignment)}
        disabled={isBusy}
        aria-label="Remove assignment"
        title="Remove volunteer"
        className="w-8 h-8 rounded-xl bg-stone-50 hover:bg-red-50 border border-stone-200 hover:border-red-200 flex items-center justify-center text-stone-400 hover:text-red-500 disabled:opacity-40 transition-all cursor-pointer shrink-0"
      >
        {isBusy
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <UserMinus className="w-3.5 h-3.5" />
        }
      </button>
    </div>
  );
}

// ─── Remove Volunteer Confirmation Modal ──────────────────────────────────────

function RemoveVolunteerModal({ assignment, onConfirm, onClose, removing }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-['Poppins',sans-serif] animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden flex flex-col p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <UserMinus className="w-7 h-7" />
        </div>

        <h3 className="text-[17px] font-bold text-stone-900 mb-1">Unassign Volunteer?</h3>
        <p className="text-[13px] text-stone-600 mb-2">
          Are you sure you want to remove <strong className="text-stone-900">{assignment.volunteerName}</strong> from this event?
        </p>
        <p className="text-[11px] text-stone-500 bg-stone-50 p-2.5 rounded-xl border border-stone-200 mb-5">
          They will no longer be able to scan or verify devotee QR passes for this event.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={removing}
            className="flex-1 h-11 rounded-2xl border border-stone-200 bg-white text-stone-600 text-[13px] font-medium hover:bg-stone-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={removing}
            className="flex-1 h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Unassign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

/**
 * @param {{ eventId: string, assignedByUid: string }} props
 */
export default function AssignVolunteerPanel({ eventId, assignedByUid }) {
  const [assignments, setAssignments]         = useState([]);
  const [statsByVol, setStatsByVol]           = useState({});
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');
  const [removing, setRemoving]               = useState(null);
  const [showPicker, setShowPicker]           = useState(false);
  const [viewingVolunteer, setViewingVolunteer] = useState(null); // { volunteer, stats }
  const [confirmRemoveModal, setConfirmRemoveModal] = useState(null); // assignment object

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [assignmentData, statsData] = await Promise.all([
        getAssignmentsForEvent(eventId),
        getEventVerificationStatsByVolunteer(eventId),
      ]);
      setAssignments(assignmentData);
      setStatsByVol(statsData);
    } catch (err) {
      console.error('[AssignVolunteerPanel]', err);
      setError('Unable to load assignments.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const handleRemove = async (assignment) => {
    setRemoving(assignment.id);
    try {
      await removeAssignment(assignment.eventId, assignment.volunteerUid);
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
      setConfirmRemoveModal(null);
    } catch (err) {
      console.error('[removeAssignment]', err);
    } finally {
      setRemoving(null);
    }
  };

  const existingUids = new Set(assignments.map((a) => a.volunteerUid));

  return (
    <>
      {/* Volunteer picker modal */}
      {showPicker && (
        <VolunteerPickerModal
          eventId={eventId}
          existingUids={existingUids}
          assignedBy={assignedByUid}
          onAssigned={() => { setShowPicker(false); loadAssignments(); }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Remove Confirmation Modal */}
      {confirmRemoveModal && (
        <RemoveVolunteerModal
          assignment={confirmRemoveModal}
          onConfirm={() => handleRemove(confirmRemoveModal)}
          onClose={() => setConfirmRemoveModal(null)}
          removing={removing === confirmRemoveModal.id}
        />
      )}

      {/* Verified Devotees Modal (SUPER ADMIN ONLY) */}
      {viewingVolunteer && (
        <VerifiedDevoteesModal
          eventId={eventId}
          volunteer={viewingVolunteer.volunteer}
          stats={viewingVolunteer.stats}
          onClose={() => setViewingVolunteer(null)}
        />
      )}

      <div className="rounded-2xl bg-white border border-stone-200/80 overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <span className="text-[13px] font-bold text-stone-800">Assigned Volunteers</span>
            {!loading && assignments.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center">
                {assignments.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.97] text-white text-[12px] font-semibold transition-all cursor-pointer shadow-sm shadow-amber-900/20"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Assign
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
              <AlertCircle className="w-4 h-4 shrink-0" /><span className="font-medium">{error}</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && assignments.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-stone-300" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-stone-600">No volunteers assigned yet</p>
                <p className="text-[11px] text-stone-400 mt-0.5">Tap <strong>Assign</strong> above to add agents</p>
              </div>
            </div>
          )}

          {/* Assignment chips */}
          {!loading && assignments.length > 0 && (
            <div className="space-y-2">
              {assignments.map((a) => (
                <AssignmentChip
                  key={a.id}
                  assignment={a}
                  stats={statsByVol[a.volunteerUid]}
                  onViewDevotees={(vol, st) => setViewingVolunteer({ volunteer: vol, stats: st })}
                  onRemove={(assignment) => setConfirmRemoveModal(assignment)}
                  removing={removing}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
