/**
 * DashboardScreen — /dashboard
 *
 * Role-aware dashboard:
 *  SUPER_ADMIN      → full event overview, manage events, manage volunteers, QR scan
 *  VERIFICATION_AGENT → only assigned events, QR scan
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, QrCode, Search, ShieldCheck, Sparkles, ArrowRight,
  Calendar, CalendarCheck, Loader2, CalendarRange,
  UsersRound, CalendarX2, ChevronRight, MapPin, Gift,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { getEventStats, getEvents, getEventById, syncEventStatuses, resolveStartDate, resolveEndDate } from '../services/eventService';
import { getAssignedEventIds } from '../services/assignmentService';
import { getVolunteerVerificationCount } from '../services/verificationService';
import { USER_ROLES } from '../types/user';
import { EVENT_STATUSES, EVENT_STATUS_STYLES, EVENT_STATUS_LABELS } from '../types/event';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(event) {
  const startTs = resolveStartDate(event);
  const endTs   = resolveEndDate(event);
  if (!startTs) return '—';
  if (event.isSingleDay || !endTs) return formatDate(startTs);
  return `${formatDate(startTs)} – ${formatDate(endTs)}`;
}

function StatusPill({ status }) {
  const s = EVENT_STATUS_STYLES[status] ?? EVENT_STATUS_STYLES.UPCOMING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {EVENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, iconColour }) {
  return (
    <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs flex flex-col gap-1">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColour}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="text-[22px] font-bold text-stone-900 leading-none mt-1">{value}</div>
      <div className="text-[11px] font-semibold text-stone-600 leading-tight">{label}</div>
      <div className="text-[10px] text-stone-400">{sub}</div>
    </div>
  );
}

// ─── Active Events Section ────────────────────────────────────────────────────
// Displays highlighted cards for active events. Only renders if there are active events.

function ActiveEventsSection({ activeEvents, navigate }) {
  if (!activeEvents || activeEvents.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <span className="text-[12px] font-bold text-emerald-700 uppercase tracking-wider">
          Live Now — {activeEvents.length} Active Event{activeEvents.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Active event cards */}
      {activeEvents.map((event) => (
        <button
          key={event.id}
          onClick={() => navigate(`/events/${event.id}`)}
          className="w-full text-left rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:border-emerald-500 active:scale-[0.99] transition-all cursor-pointer group bg-gradient-to-br from-emerald-50 to-white"
        >
          <div className="flex">
            {/* Pulsing accent bar */}
            <div className="w-1.5 shrink-0 bg-emerald-500" />

            <div className="flex-1 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* LIVE badge */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Live
                    </span>
                  </div>
                  <p className="text-[15px] font-bold text-stone-900 leading-snug truncate">{event.name}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[12px] text-emerald-700 font-medium">
                      <Calendar className="w-3 h-3" />{formatDateRange(event)}
                    </span>
                    <span className="flex items-center gap-1 text-[12px] text-stone-500">
                      <MapPin className="w-3 h-3 text-amber-500" />{event.location}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:text-emerald-600 shrink-0 transition-colors mt-1" />
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}


// ─── SUPER_ADMIN view ─────────────────────────────────────────────────────────

function AdminDashboard({ userProfile, navigate }) {
  const [stats, setStats]           = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [activeEvents, setActiveEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;

    getEvents()
      .then((raw) => syncEventStatuses(raw))
      .then((synced) => {
        if (!cancelled) {
          setActiveEvents(synced.filter((e) => e.status === EVENT_STATUSES.ACTIVE));
          setStats({
            total:     synced.length,
            active:    synced.filter((e) => e.status === EVENT_STATUSES.ACTIVE).length,
            upcoming:  synced.filter((e) => e.status === EVENT_STATUSES.UPCOMING).length,
            completed: synced.filter((e) => e.status === EVENT_STATUSES.COMPLETED).length,
          });
        }
      })
      .catch((err) => {
        console.error('[Dashboard] load events', err);
        if (!cancelled) setStatsError(true);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5">
      {/* ── Simple Devotional Header ──────────────────────────────────────── */}
      <div className="pt-2 pb-1">
        <p className="text-[13px] font-semibold text-amber-800 tracking-wide mb-1">
          Hare Krishna 🙏
        </p>
        <h1 className="text-[22px] sm:text-[24px] font-bold text-stone-900 tracking-tight leading-tight">
          Yatra Seva Portal
        </h1>
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
            Super Admin
          </span>
          <span className="text-[13px] text-stone-600 font-medium">
            {userProfile?.name || 'Admin'}
          </span>
          <span className="text-stone-300">•</span>
          <span className="text-[12px] font-mono text-stone-500">
            {userProfile?.userId || userProfile?.email}
          </span>
        </div>
      </div>

      {/* ── Active events highlight (only shows if active events exist) ── */}
      <ActiveEventsSection activeEvents={activeEvents} navigate={navigate} />

      {/* Event overview */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider">Event Overview</span>
          <button onClick={() => navigate('/events')} className="text-[12px] font-semibold text-amber-700 hover:underline cursor-pointer">Manage Events →</button>
        </div>

        {stats === null && !statsError && (
          <div className="grid grid-cols-3 gap-3">
            {[0,1,2].map((i) => <div key={i} className="p-3.5 rounded-2xl bg-white border border-stone-200/80 animate-pulse h-20" />)}
          </div>
        )}
        {statsError && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-[12px] text-center">Unable to load event data.</div>
        )}
        {stats !== null && !statsError && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={Calendar}      label="Total"    value={stats.total}    sub="All Yatras"   iconColour="bg-sky-100 text-sky-700" />
            <StatCard icon={CalendarCheck} label="Active"   value={stats.active}   sub="In progress"  iconColour="bg-emerald-100 text-emerald-700" />
            <StatCard icon={CalendarRange} label="Upcoming" value={stats.upcoming} sub="Scheduled"    iconColour="bg-amber-100 text-amber-700" />
          </div>
        )}
      </div>

      {/* Team & Member management shortcut */}
      <button
        onClick={() => navigate('/volunteers')}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-stone-200/80 hover:border-amber-300 hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <UsersRound className="w-5 h-5 text-violet-700" />
          </div>
          <div className="text-left">
            <p className="text-[14px] font-semibold text-stone-800">Team &amp; Access Management</p>
            <p className="text-[12px] text-stone-500">Manage all members: volunteers, admins &amp; roles</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-amber-600 transition-colors" />
      </button>

      {/* Scan QR */}
      <ScanCard navigate={navigate} />

      {/* Quick ID lookup */}
      <QuickLookup navigate={navigate} />
    </div>
  );
}

// ─── VERIFICATION_AGENT view ──────────────────────────────────────────────────

function AgentDashboard({ userProfile, firebaseUser, navigate }) {
  const [assignedEvents, setEvents] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [eventCounts, setEventCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const eventIds = await getAssignedEventIds(firebaseUser.uid);
        const settled  = await Promise.allSettled(eventIds.map((id) => getEventById(id)));
        const raw      = settled
          .filter((r) => r.status === 'fulfilled' && r.value)
          .map((r) => r.value);
        const events = await syncEventStatuses(raw);
        if (!cancelled) {
          setEvents(events);
        }
      } catch (err) {
        console.error('[AgentDashboard]', err);
        if (!cancelled) setError('Unable to load your assigned events.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [firebaseUser?.uid]);

  // Load verification count per event for this volunteer
  useEffect(() => {
    if (!firebaseUser?.uid || assignedEvents.length === 0) return;
    let cancelled = false;
    Promise.all(
      assignedEvents.map(async (ev) => {
        try {
          const count = await getVolunteerVerificationCount(firebaseUser.uid, ev.id);
          return [ev.id, count];
        } catch {
          return [ev.id, 0];
        }
      })
    ).then((results) => {
      if (!cancelled) {
        setEventCounts(Object.fromEntries(results));
      }
    });
    return () => { cancelled = true; };
  }, [firebaseUser?.uid, assignedEvents]);

  const activeEvents = assignedEvents.filter((e) => e.status === EVENT_STATUSES.ACTIVE);

  return (
    <div className="space-y-5">
      {/* ── Simple Devotional Header ──────────────────────────────────────── */}
      <div className="pt-2 pb-1">
        <p className="text-[13px] font-semibold text-emerald-800 tracking-wide mb-1">
          Hare Krishna 🙏
        </p>
        <h1 className="text-[22px] sm:text-[24px] font-bold text-stone-900 tracking-tight leading-tight">
          Seva Verification Portal
        </h1>
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
            Volunteer Agent
          </span>
          <span className="text-[13px] text-stone-600 font-medium">
            {userProfile?.name || 'Devotee'}
          </span>
          <span className="text-stone-300">•</span>
          <span className="text-[12px] font-mono text-stone-500">
            {userProfile?.userId || userProfile?.email}
          </span>
        </div>
      </div>

      {/* ── Active assigned events highlight (only shows if active) ────── */}
      <ActiveEventsSection activeEvents={activeEvents} navigate={navigate} />

      {/* Scan QR */}
      <ScanCard navigate={navigate} />

      {/* All assigned events */}
      <div>
        <span className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider">Your Assigned Events</span>

        {loading && (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div>
        )}
        {!loading && error && (
          <div className="mt-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">{error}</div>
        )}
        {!loading && !error && assignedEvents.length === 0 && (
          <div className="mt-3 flex flex-col items-center gap-3 py-10 text-center">
            <CalendarX2 className="w-8 h-8 text-stone-300" />
            <p className="text-[13px] text-stone-600 font-medium">No events assigned yet.</p>
            <p className="text-[12px] text-stone-400">Contact your Super Admin to get assigned to a Yatra.</p>
          </div>
        )}
        {!loading && assignedEvents.length > 0 && (
          <div className="mt-3 space-y-2">
            {assignedEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className="w-full text-left bg-white border border-stone-200/80 rounded-2xl p-4 hover:border-amber-300 hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusPill status={event.status} />
                      {eventCounts[event.id] > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                          <Gift className="w-3 h-3 text-emerald-600" />
                          {eventCounts[event.id]} verified by you
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-semibold text-stone-900 truncate">{event.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[12px] text-stone-500">
                        <Calendar className="w-3 h-3 text-amber-500" />{formatDateRange(event)}
                      </span>
                      <span className="flex items-center gap-1 text-[12px] text-stone-500">
                        <MapPin className="w-3 h-3 text-amber-500" />{event.location}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-600 shrink-0 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ScanCard({ navigate }) {
  return (
    <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-3xl p-5 text-white shadow-xl shadow-amber-900/20">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[12px] font-medium">
          Fast Gate Verification
        </div>
        <div>
          <h2 className="text-[20px] font-bold tracking-tight">Scan Devotee QR Pass</h2>
          <p className="text-[12px] text-amber-100 mt-1 leading-relaxed">
            Scan the devotee badge or registration QR code to verify details.
          </p>
        </div>
        <button
          onClick={() => navigate('/scan')}
          className="w-full h-12 bg-white hover:bg-amber-50 active:scale-[0.98] text-amber-900 font-semibold text-[14px] rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <QrCode className="w-4 h-4 text-amber-700" />
          <span>Open QR Scanner</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function QuickLookup({ navigate }) {
  const [manualId, setManualId] = useState('');
  const handleSearch = (e) => {
    e?.preventDefault();
    const cleanId = manualId.trim().toUpperCase();
    if (cleanId) navigate(`/registration/${cleanId}`);
  };
  return (
    <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-3">
      <label className="block text-[12px] font-semibold text-stone-700 uppercase tracking-wider">Quick ID Lookup</label>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="e.g. YAT-00125"
            className="w-full h-11 pl-9 pr-3 text-[14px] bg-stone-50 focus:bg-white text-stone-900 rounded-xl border border-stone-200 focus:border-amber-500 outline-none uppercase font-mono"
          />
        </div>
        <button type="submit" className="px-4 h-11 bg-stone-900 hover:bg-stone-800 text-white font-medium text-[12px] rounded-xl cursor-pointer">View</button>
      </form>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { userProfile, firebaseUser, role, logout } = useAuth();

  const [showSignOut, setShowSignOut] = useState(false);
  const [signingOut, setSigningOut]   = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login-page');
    } finally {
      setSigningOut(false);
      setShowSignOut(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F3ECE0] text-stone-800 select-none font-['Poppins',sans-serif]">

      {/* ── Sign-out confirmation overlay ─────────────────────────────── */}
      {showSignOut && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !signingOut && setShowSignOut(false)}
        >
          <div
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-stone-200 mx-auto mb-6" />

            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 text-red-500" />
            </div>

            <h2 className="text-[17px] font-bold text-stone-900 text-center">Sign Out?</h2>
            <p className="text-[13px] text-stone-500 text-center mt-1.5 leading-relaxed">
              You'll be returned to the login page.<br />Any unsaved work will be lost.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSignOut(false)}
                disabled={signingOut}
                className="flex-1 h-12 rounded-2xl border border-stone-200 text-stone-700 text-[14px] font-semibold hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={signingOut}
                className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-70 shadow-md shadow-red-900/20"
              >
                {signingOut
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><LogOut className="w-4 h-4" /><span>Sign Out</span></>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="pt-4 px-6 flex items-center justify-between z-10 shrink-0 max-w-lg mx-auto w-full">
        {/* Left Branding */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/70 border border-amber-200 text-amber-900">
          <span className="text-[11px] font-semibold tracking-wider uppercase">
            Yatra Seva
          </span>
        </div>

        {/* Right Sign Out */}
        <button
          onClick={() => setShowSignOut(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-red-700 hover:border-red-200 text-[12px] font-medium transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Role-specific content */}
      <div className="flex-1 px-6 pt-5 pb-8 overflow-y-auto max-w-lg mx-auto w-full">
        {role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.ADMIN
          ? <AdminDashboard userProfile={userProfile} navigate={navigate} />
          : <AgentDashboard userProfile={userProfile} firebaseUser={firebaseUser} navigate={navigate} />
        }
      </div>
    </div>
  );
}
