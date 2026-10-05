/**
 * EventsScreen — /events
 *
 * Lists all Yatra events from Firestore.
 * Full-screen modal sheet for creating a new event (no UI squash).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ArrowLeft, Calendar, MapPin, ChevronRight,
  Loader2, AlertCircle, CalendarX2, X, Check,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
  getEvents, createEvent, syncEventStatuses,
  resolveStartDate, resolveEndDate,
} from '../../services/eventService';
import { getRegistrationStats } from '../../services/registrationService';
import {
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_STYLES,
} from '../../types/event';
import { Timestamp } from 'firebase/firestore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Returns "14 Sep 2026" for single-day or "14–16 Sep 2026" for multi-day */
function formatDateRange(event) {
  const startTs = resolveStartDate(event);
  const endTs   = resolveEndDate(event);
  if (!startTs) return '—';
  if (event.isSingleDay || !endTs) return fmt(startTs);

  const start = startTs.toDate();
  const end   = endTs.toDate();
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    const startDay = start.toLocaleDateString('en-IN', { day: 'numeric' });
    return `${startDay}–${fmt(endTs)}`;
  }
  return `${fmt(startTs)} – ${fmt(endTs)}`;
}

function StatusBadge({ status }) {
  const s = EVENT_STATUS_STYLES[status] ?? EVENT_STATUS_STYLES.UPCOMING;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {EVENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Create Event Modal ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  name:        '',
  isSingleDay: true,
  startDate:   '',
  endDate:     '',
  location:    '',
  description: '',
};

function CreateEventModal({ onCreated, onClose, creatorUid }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())    return setError('Event name is required.');
    if (!form.startDate)      return setError('Start date is required.');
    if (!form.isSingleDay && !form.endDate) return setError('End date is required for multi-day events.');
    if (!form.location.trim()) return setError('Location is required.');

    const startTs = Timestamp.fromDate(new Date(form.startDate));
    const endTs   = form.isSingleDay
      ? startTs
      : Timestamp.fromDate(new Date(form.endDate));

    if (!form.isSingleDay && endTs.toMillis() < startTs.toMillis()) {
      return setError('End date must be on or after start date.');
    }

    setSaving(true);
    try {
      const newId = await createEvent({
        name:        form.name,
        startDate:   startTs,
        endDate:     endTs,
        isSingleDay: form.isSingleDay,
        location:    form.location,
        description: form.description,
        createdBy:   creatorUid,
      });
      onCreated(newId);
    } catch (err) {
      console.error('[CreateEventModal]', err);
      setError('Failed to create event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full h-11 px-3.5 text-[14px] bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all';
  const labelCls =
    'block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5';

  return (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAF7F2] font-['Poppins',sans-serif] overflow-hidden">

      {/* Modal header */}
      <header className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-stone-200/70 bg-white shrink-0">
        <div>
          <h2 className="text-[17px] font-bold text-stone-900">New Yatra Event</h2>
          <p className="text-[12px] text-stone-500 mt-0.5">Fill in the details below</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-lg mx-auto">
          <form onSubmit={handleSubmit} className="space-y-5" id="create-event-form">

            {error && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Name */}
            <div>
              <label className={labelCls}>Event / Yatra Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. Sri Krishna Janmashtami Yatra 2026"
                className={inputCls}
                autoFocus
              />
            </div>

            {/* Single / Multi-day toggle */}
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
                    className={`h-10 rounded-xl text-[13px] font-semibold border transition-all cursor-pointer
                      ${form.isSingleDay === value
                        ? 'bg-amber-50 text-amber-800 border-amber-400 ring-2 ring-amber-400/30'
                        : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
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
                <label className={labelCls}>{form.isSingleDay ? 'Date *' : 'Start Date *'}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={set('startDate')}
                  className={inputCls}
                />
              </div>
              {!form.isSingleDay && (
                <div>
                  <label className={labelCls}>End Date *</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={set('endDate')}
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label className={labelCls}>Location *</label>
              <input
                type="text"
                value={form.location}
                onChange={set('location')}
                placeholder="e.g. Hyderabad"
                className={inputCls}
              />
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={form.description}
                onChange={set('description')}
                placeholder="Brief description of the event…"
                rows={4}
                className="w-full px-3.5 py-3 text-[14px] bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all resize-none"
              />
            </div>

            {/* Auto-status hint */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-[11px]">
              <Calendar className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-500" />
              <span>Status will be set automatically — <strong>Upcoming</strong> until the start date, <strong>Active</strong> during the event, <strong>Completed</strong> once it ends.</span>
            </div>

          </form>
        </div>
      </div>

      {/* Sticky footer actions */}
      <div className="shrink-0 px-6 py-4 bg-white border-t border-stone-200/70">
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl border border-stone-200 text-stone-600 text-[14px] font-medium hover:bg-stone-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-event-form"
            disabled={saving}
            className="flex-[2] h-12 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-70 cursor-pointer shadow-md shadow-amber-900/20"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Check className="w-4 h-4" /><span>Create Event</span></>
            }
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────


const STATUS_ACCENT = {
  UPCOMING:  'bg-sky-500',
  ACTIVE:    'bg-emerald-500',
  COMPLETED: 'bg-stone-400',
};

function EventCard({ event, stats, onClick }) {
  const accent = STATUS_ACCENT[event.status] ?? 'bg-stone-300';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-stone-200/80 rounded-2xl overflow-hidden hover:border-amber-300 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer group"
    >
      <div className="flex">
        {/* Left colour accent bar */}
        <div className={`w-1 shrink-0 ${accent}`} />

        {/* Card content */}
        <div className="flex-1 p-4">
          {/* Top row: status + arrow */}
          <div className="flex items-center justify-between mb-2">
            <StatusBadge status={event.status} />
            <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-500 transition-colors" />
          </div>

          {/* Event name */}
          <h3 className="text-[15px] font-semibold text-stone-900 leading-snug line-clamp-2 mb-2.5">
            {event.name}
          </h3>

          {/* Meta row */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {formatDateRange(event)}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {event.location}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5 mt-3 pt-3 border-t border-stone-100">
            {stats
              ? <>
                  <Stat label="Registrations" value={stats.total}    colour="text-stone-800" />
                  <Stat label="Verified"       value={stats.verified} colour="text-emerald-700" />
                  <Stat label="Pending"        value={stats.pending}  colour="text-amber-700" />
                </>
              : <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-300" />
            }
          </div>
        </div>
      </div>
    </button>
  );
}

function Stat({ label, value, colour }) {
  return (
    <div>
      <div className={`text-[14px] font-bold ${colour}`}>{value}</div>
      <div className="text-[11px] text-stone-400 leading-tight">{label}</div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const navigate         = useNavigate();
  const { firebaseUser } = useAuth();

  const [events, setEvents]         = useState([]);
  const [eventStats, setEventStats] = useState({});   // { [eventId]: RegistrationStats }
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showModal, setModal]       = useState(false);
  const [successMsg, setSuccess]    = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw  = await getEvents();
      // Auto-correct statuses based on today's date (writes back to Firestore only on changes)
      const data = await syncEventStatuses(raw);
      setEvents(data);

      // Fetch registration stats for all events in parallel
      const statsEntries = await Promise.all(
        data.map(async (ev) => {
          try {
            const s = await getRegistrationStats(ev.id);
            return [ev.id, s];
          } catch {
            return [ev.id, { total: 0, verified: 0, pending: 0 }];
          }
        })
      );
      setEventStats(Object.fromEntries(statsEntries));
    } catch (err) {
      console.error('[EventsScreen] load', err);
      setError('Unable to load events. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleCreated = async () => {
    setModal(false);
    setSuccess('Event created successfully.');
    setTimeout(() => setSuccess(''), 4000);
    await loadEvents();
  };

  // Active / upcoming counts for the summary row
  const activeCount   = events.filter((e) => e.status === EVENT_STATUSES.ACTIVE).length;
  const upcomingCount = events.filter((e) => e.status === EVENT_STATUSES.UPCOMING).length;

  return (
    <>
      {/* ── Full-screen create modal ─────────────────────────────────────── */}
      {showModal && (
        <CreateEventModal
          onCreated={handleCreated}
          onClose={() => setModal(false)}
          creatorUid={firebaseUser?.uid}
        />
      )}

      <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F3ECE0] text-stone-800 select-none font-['Poppins',sans-serif]">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className="shrink-0 pt-4 px-5 pb-3 flex items-center gap-3 bg-white/70 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-20">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-white border border-stone-200 shadow-xs flex items-center justify-center text-stone-600 hover:text-amber-800 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer shrink-0"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-[19px] font-bold text-stone-900 tracking-tight leading-tight">Yatra Events</h1>
            <p className="text-[12px] text-stone-500 leading-tight">Schedule, coordinate &amp; verify</p>
          </div>

          <button
            onClick={() => setModal(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-95 text-white text-[13px] font-semibold shadow-md shadow-amber-900/15 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </header>

        {/* ── Summary strip ─────────────────────────────────────────────── */}
        {!loading && !error && events.length > 0 && (
          <div className="shrink-0 px-5 pb-3 flex items-center gap-2">
            <SummaryPill label="All" value={events.length} colour="bg-stone-100 text-stone-700" />
            <SummaryPill label="Active"   value={activeCount}   colour="bg-emerald-50 text-emerald-700 border border-emerald-200" />
            <SummaryPill label="Upcoming" value={upcomingCount} colour="bg-sky-50 text-sky-700 border border-sky-200" />
          </div>
        )}

        {/* ── Scrollable content ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pb-10">
          <div className="max-w-lg mx-auto space-y-3 pt-1">

            {/* Success toast */}
            {successMsg && (
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                {successMsg}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-600" />
                  <span className="text-[12px] text-stone-400 font-medium">Loading events…</span>
                </div>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-stone-800">Unable to load events</p>
                  <p className="text-[12px] text-stone-500 mt-1">{error}</p>
                </div>
                <button
                  onClick={loadEvents}
                  className="px-5 h-9 rounded-xl bg-stone-900 text-white text-[12px] font-semibold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && events.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <CalendarX2 className="w-8 h-8 text-amber-400" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-stone-800">No events yet</p>
                  <p className="text-[12px] text-stone-500 mt-1 max-w-[220px]">
                    Create your first Yatra event to get started.
                  </p>
                </div>
                <button
                  onClick={() => setModal(true)}
                  className="inline-flex items-center gap-1.5 px-5 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-semibold cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create First Event
                </button>
              </div>
            )}

            {/* Event list */}
            {!loading && !error && events.length > 0 &&
              events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  stats={eventStats[event.id] ?? null}
                  onClick={() => navigate(`/events/${event.id}`)}
                />
              ))
            }

          </div>
        </div>
      </div>
    </>
  );
}

function SummaryPill({ label, value, colour }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[12px] font-semibold ${colour}`}>
      <span className="font-bold">{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </div>
  );
}
