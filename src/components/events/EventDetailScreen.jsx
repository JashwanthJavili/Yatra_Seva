/**
 * EventDetailScreen — /events/:eventId
 *
 * Shows full event details, live registration statistics from Firestore,
 * inline edit form, status change controls, and the registration import panel.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import {
  ArrowLeft, Calendar, MapPin, FileText, Edit2, X, Check,
  Loader2, AlertCircle, Users, ShieldCheck, Clock, Gift,
  FileSpreadsheet, RefreshCw, QrCode, ChevronRight,
} from 'lucide-react';
import { getEventById, updateEvent, syncEventStatuses, resolveStartDate, resolveEndDate } from '../../services/eventService';
import { getRegistrationStats } from '../../services/registrationService';
import { getVolunteerVerificationCount } from '../../services/verificationService';
import {
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_STYLES,
} from '../../types/event';
import { Timestamp } from 'firebase/firestore';
import RegistrationImport from './RegistrationImport';
import RegistrationListModal from './RegistrationListModal';
import AssignVolunteerPanel from '../volunteers/AssignVolunteerPanel';
import { USER_ROLES } from '../../types/user';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtShort(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "Monday, 14 September 2026" for single-day; "14 September – 16 September 2026" for multi-day */
function formatDateRange(event) {
  const startTs = resolveStartDate(event);
  const endTs   = resolveEndDate(event);
  if (!startTs) return '—';
  if (event.isSingleDay || !endTs) return fmt(startTs);
  return `${fmtShort(startTs)} – ${fmtShort(endTs)}`;
}

function tsToInputDate(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split('T')[0];
}

function StatusBadge({ status, large }) {
  const s = EVENT_STATUS_STYLES[status] ?? EVENT_STATUS_STYLES.UPCOMING;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold border ${s.bg} ${s.text} ${s.border} ${large ? 'text-[13px]' : 'text-[11px]'}`}>
      {EVENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

function EditEventForm({ event, onSaved, onCancel }) {
  const startTs = resolveStartDate(event);
  const endTs   = resolveEndDate(event);

  const [form, setForm] = useState({
    name:        event.name        ?? '',
    isSingleDay: event.isSingleDay ?? true,
    startDate:   tsToInputDate(startTs),
    endDate:     event.isSingleDay ? '' : tsToInputDate(endTs),
    location:    event.location    ?? '',
    description: event.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())     return setError('Event name is required.');
    if (!form.startDate)       return setError('Start date is required.');
    if (!form.isSingleDay && !form.endDate) return setError('End date is required.');
    if (!form.location.trim()) return setError('Location is required.');

    const newStartTs = Timestamp.fromDate(new Date(form.startDate));
    const newEndTs   = form.isSingleDay
      ? newStartTs
      : Timestamp.fromDate(new Date(form.endDate));

    if (!form.isSingleDay && newEndTs.toMillis() < newStartTs.toMillis()) {
      return setError('End date must be on or after start date.');
    }

    setSaving(true);
    try {
      const updates = {
        name:        form.name,
        startDate:   newStartTs,
        endDate:     newEndTs,
        isSingleDay: form.isSingleDay,
        location:    form.location,
        description: form.description,
      };
      await updateEvent(event.id, updates);
      // status is recomputed by updateEvent and returned via the updated fields
      const [synced] = await syncEventStatuses([{ ...event, ...updates }]);
      onSaved(synced);
    } catch (err) {
      console.error('[EditEventForm]', err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full h-11 px-3.5 text-[14px] bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all';
  const labelCls = 'block text-[12px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5';

  return (
    <div className="bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-amber-50/60">
        <h2 className="text-[15px] font-semibold text-stone-800">Edit Event</h2>
        <button type="button" onClick={onCancel} className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
            <AlertCircle className="w-4 h-4 shrink-0" /><span className="font-medium">{error}</span>
          </div>
        )}

        {/* Name */}
        <div>
          <label className={labelCls}>Event / Yatra Name</label>
          <input type="text" value={form.name} onChange={set('name')} className={inputCls} required />
        </div>

        {/* Single / Multi-day */}
        <div>
          <label className={labelCls}>Event Duration</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Single Day',    value: true  },
              { label: 'Multiple Days', value: false },
            ].map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setForm((prev) => ({ ...prev, isSingleDay: value, endDate: value ? '' : prev.endDate }));
                  if (error) setError('');
                }}
                className={`h-9 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer
                  ${form.isSingleDay === value
                    ? 'bg-amber-50 text-amber-800 border-amber-400 ring-2 ring-amber-400/30'
                    : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date(s) */}
        <div className={`grid gap-3 ${form.isSingleDay ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div>
            <label className={labelCls}>{form.isSingleDay ? 'Date' : 'Start Date'}</label>
            <input type="date" value={form.startDate} onChange={set('startDate')} className={inputCls} required />
          </div>
          {!form.isSingleDay && (
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={set('endDate')} className={inputCls} required />
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <label className={labelCls}>Location</label>
          <input type="text" value={form.location} onChange={set('location')} className={inputCls} required />
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <textarea value={form.description} onChange={set('description')} rows={3}
            className="w-full px-3.5 py-2.5 text-[14px] bg-stone-50 focus:bg-white text-stone-900 rounded-xl border border-stone-200 focus:border-amber-500 outline-none resize-none transition-all" />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 h-11 rounded-xl border border-stone-200 text-stone-600 text-[13px] font-medium hover:bg-stone-50 cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-70 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /><span>Save Changes</span></>}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, colour, loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || !onClick}
      className={`p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs flex flex-col gap-1 text-left transition-all ${
        onClick
          ? 'hover:border-amber-300 hover:shadow-xs active:scale-[0.98] cursor-pointer group'
          : 'cursor-default'
      }`}
    >
      <div className="flex items-center justify-between w-full">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colour}`}>
          <Icon className="w-4 h-4" />
        </div>
        {onClick && (
          <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
      <div className="text-[22px] font-bold text-stone-900 leading-none mt-1">
        {loading ? <span className="inline-block w-8 h-5 rounded bg-stone-200 animate-pulse" /> : value}
      </div>
      <div className="text-[11px] font-medium text-stone-500 flex items-center justify-between w-full">
        <span>{label}</span>
        {onClick && (
          <span className="text-[10px] text-amber-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            View &gt;
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Registration Data Section ────────────────────────────────────────────────

function RegistrationDataSection({ eventId, stats, statsLoading, onOpenImport, onSelectStat }) {
  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider">
            Registration Data
          </p>
          <p className="text-[11px] text-stone-400">Click any card to view records</p>
        </div>
        <button
          onClick={onOpenImport}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-semibold cursor-pointer transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Upload Excel
        </button>
      </div>

      {/* Stats grid — 3 columns */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          icon={Users}
          label="Total Registered Devotees"
          value={stats?.total ?? 0}
          colour="bg-sky-100 text-sky-700"
          loading={statsLoading}
          onClick={onSelectStat ? () => onSelectStat('ALL') : undefined}
        />
        <StatCard
          icon={ShieldCheck}
          label="Verified Devotees"
          value={stats?.verified ?? stats?.goodiesIssued ?? 0}
          colour="bg-emerald-100 text-emerald-700"
          loading={statsLoading}
          onClick={onSelectStat ? () => onSelectStat('VERIFIED') : undefined}
        />
        <StatCard
          icon={Clock}
          label="Pending Devotees"
          value={stats?.pending ?? 0}
          colour="bg-amber-100 text-amber-700"
          loading={statsLoading}
          onClick={onSelectStat ? () => onSelectStat('PENDING') : undefined}
        />
      </div>

      {!statsLoading && (stats?.total ?? 0) === 0 && (
        <p className="text-[11px] text-stone-400 text-center pt-1">
          No registrations imported yet. Upload an Excel file to get started.
        </p>
      )}
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { eventId } = useParams();
  const navigate    = useNavigate();
  const { firebaseUser, role } = useAuth();

  const [event, setEvent]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error,  setError]      = useState('');
  const [editing, setEditing]   = useState(false);
  const [successMsg, setSuccess] = useState('');

  // Registration stats
  const [regStats,    setRegStats]    = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Volunteer's personal count in this event (COUNT ONLY, NO NAMES)
  const [myEventCount, setMyEventCount] = useState(null);

  // Import modal
  const [showImport, setShowImport] = useState(false);

  // Registration list viewer modal (Super Admin)
  const [showRegList, setShowRegList] = useState(false);
  const [regListTab,  setRegListTab]  = useState('ALL');

  // ── Load event ────────────────────────────────────────────────────────────
  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await getEventById(eventId);
      if (!raw) { setError('Event not found.'); return; }
      // Auto-correct status based on today's date
      const [data] = await syncEventStatuses([raw]);
      setEvent(data);
    } catch (err) {
      console.error('[EventDetailScreen] load', err);
      setError('Unable to load event. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // ── Load registration stats ───────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await getRegistrationStats(eventId);
      setRegStats(s);
    } catch (err) {
      console.error('[EventDetailScreen] stats', err);
      setRegStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
    loadStats();
  }, [loadEvent, loadStats]);

  useEffect(() => {
    if (role === USER_ROLES.VERIFICATION_AGENT && firebaseUser?.uid && eventId) {
      getVolunteerVerificationCount(firebaseUser.uid, eventId)
        .then(setMyEventCount)
        .catch((err) => console.error('[EventDetailScreen] count', err));
    }
  }, [role, firebaseUser?.uid, eventId]);

  const handleSaved = (updated) => {
    setEvent(updated);
    setEditing(false);
    setSuccess('Changes saved.');
    setTimeout(() => setSuccess(''), 3500);
  };

  const handleImported = () => {
    // Refresh stats after import
    loadStats();
  };

  const canManage = role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.ADMIN;

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(canManage ? '/events' : '/dashboard');
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-[#FAF7F2]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error && !event) {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center gap-4 bg-[#FAF7F2] px-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-[14px] text-stone-700 font-medium">{error}</p>
        <button onClick={handleBack} className="text-[13px] font-semibold text-amber-700 underline cursor-pointer">
          {canManage ? 'Back to Events' : 'Back to Dashboard'}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Import modal — full screen overlay */}
      {showImport && event && (
        <RegistrationImport
          eventId={eventId}
          eventName={event.name}
          existingQrColumn={event.qrIdentifierColumn ?? null}
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}

      {/* Registration list records viewer modal (Super Admin) */}
      {showRegList && (
        <RegistrationListModal
          eventId={eventId}
          eventName={event?.name}
          initialTab={regListTab}
          onClose={() => setShowRegList(false)}
        />
      )}

      <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F3ECE0] text-stone-800 select-none font-['Poppins',sans-serif]">

        {/* Header */}
        <header className="shrink-0 pt-4 px-6 pb-3 flex items-center justify-between bg-white/70 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-20">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-white border border-stone-200 shadow-xs flex items-center justify-center text-stone-600 hover:text-amber-800 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer shrink-0"
            aria-label={canManage ? "Back to events" : "Back to dashboard"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center px-2 min-w-0">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-widest block">
              Yatra Overview
            </span>
            <span className="text-[13px] font-semibold text-stone-800 truncate block max-w-[180px] sm:max-w-xs">
              {event?.name || 'Event Details'}
            </span>
          </div>

          {canManage ? (
            <button
              onClick={() => setEditing((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer shadow-2xs shrink-0
                ${editing
                  ? 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-amber-400 hover:text-amber-800'
                }`}
            >
              {editing ? <><X className="w-3.5 h-3.5" /><span>Cancel</span></> : <><Edit2 className="w-3.5 h-3.5 text-amber-600" /><span>Edit</span></>}
            </button>
          ) : (
            <div className="w-10" />
          )}
        </header>

        {/* Scrollable content */}
        <div className="flex-1 px-6 pt-5 pb-10 overflow-y-auto max-w-lg mx-auto w-full space-y-5">

          {/* Success toast */}
          {successMsg && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />{successMsg}
            </div>
          )}

          {/* Edit form */}
          {editing && (
            <EditEventForm event={event} onSaved={handleSaved} onCancel={() => setEditing(false)} />
          )}

          {/* Event info card */}
          {!editing && (
            <div className="bg-white border border-stone-200/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-[18px] font-bold text-stone-900 leading-snug">{event.name}</h1>
                <StatusBadge status={event.status} large />
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-[13px] text-stone-600">
                  <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{formatDateRange(event)}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[13px] text-stone-600">
                  <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{event.location}</span>
                </div>
                {event.description && (
                  <div className="flex items-start gap-2.5 text-[13px] text-stone-600">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{event.description}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Direct Scan QR button for active events */}
          {!editing && event.status === EVENT_STATUSES.ACTIVE && (
            <button
              onClick={() => navigate(`/scan?eventId=${event.id}`)}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] text-white font-semibold text-[14px] flex items-center justify-center gap-2.5 shadow-md shadow-emerald-900/20 transition-all cursor-pointer"
            >
              <QrCode className="w-5 h-5 text-white" />
              <span>Scan Devotee QR Pass</span>
            </button>
          )}

          {/* Volunteer's personal count in this event — COUNT ONLY, NO NAMES */}
          {role === USER_ROLES.VERIFICATION_AGENT && (
            <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Your Seva in this Event</p>
                  <p className="text-[12px] text-stone-400">Devotees verified / goodies issued</p>
                </div>
              </div>
              <span className="text-[24px] font-bold text-emerald-700">
                {myEventCount === null ? (
                  <Loader2 className="w-4 h-4 animate-spin text-stone-300" />
                ) : (
                  myEventCount
                )}
              </span>
            </div>
          )}

          {/* Registration data section — SUPER_ADMIN only */}
          {role === USER_ROLES.SUPER_ADMIN && (
            <RegistrationDataSection
              eventId={eventId}
              stats={regStats}
              statsLoading={statsLoading}
              onOpenImport={() => setShowImport(true)}
              onSelectStat={(tab) => {
                setRegListTab(tab);
                setShowRegList(true);
              }}
            />
          )}

          {/* Assigned Volunteers — SUPER_ADMIN only */}
          {role === USER_ROLES.SUPER_ADMIN && (
            <AssignVolunteerPanel
              eventId={eventId}
              assignedByUid={firebaseUser?.uid}
            />
          )}

        </div>
      </div>
    </>
  );
}
