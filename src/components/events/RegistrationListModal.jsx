/**
 * RegistrationListModal.jsx
 *
 * Super Admin modal to view, search, and drill down into registration records.
 * Accessible by clicking on any stat card (Total, Verified, Pending, Goodies Issued)
 * on the Event Detail screen.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Search, Users, ShieldCheck, Clock, Gift,
  ChevronDown, ChevronRight, ExternalLink, RefreshCw,
  Loader2, AlertCircle, CheckCircle2, User, Phone,
} from 'lucide-react';
import { getRegistrations } from '../../services/registrationService';
import { extractDevoteeName, resolveTotalDevotees } from '../../services/verificationService';
import { REGISTRATION_STATUS } from '../../types/registration';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value?.toDate) {
    return value.toDate().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return String(value);
}

function formatFullTime(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Resolves primary devotee name from sourceData */
function getPrimaryDevoteeName(sourceData) {
  if (!sourceData) return 'Devotee';
  const entries = Object.entries(sourceData);

  // Exact or close match for primary devotee name
  const primaryMatch = entries.find(([k]) => {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !/[2-9]/.test(norm) && (
      norm.includes('fullname') ||
      norm.includes('devoteename') ||
      norm.includes('candidatename') ||
      norm === 'name' ||
      norm.endsWith('name')
    );
  });
  if (primaryMatch && primaryMatch[1]) return String(primaryMatch[1]);

  return 'Devotee';
}

/** Resolves contact number from sourceData */
function getContactNumber(sourceData) {
  if (!sourceData) return null;
  const entries = Object.entries(sourceData);
  const match = entries.find(([k]) => {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return norm.includes('phone') || norm.includes('mobile') || norm.includes('contact');
  });
  return match && match[1] ? String(match[1]) : null;
}



// ─── Registration Item Card ───────────────────────────────────────────────────

function RegistrationItem({ reg, eventId, isExpanded, onToggle }) {
  const navigate = useNavigate();
  const sourceData = reg.sourceData || {};
  const sysData    = reg.systemData || {};
  const isVerified = sysData.status === REGISTRATION_STATUS.VERIFIED;
  const hasGoodie  = sysData.goodieKitIssued || (sysData.devotees || []).some((d) => d.goodieKitIssued);

  const primaryName = (
    sysData.devotees?.[0]?.devoteeName && !sysData.devotees[0].devoteeName.startsWith('Devotee')
      ? sysData.devotees[0].devoteeName
      : extractDevoteeName(0, sourceData)
  ) || reg._id;
  const phone       = getContactNumber(sourceData);
  const totalDevotees = resolveTotalDevotees(sourceData, sysData);

  const devoteeList = Array.isArray(sysData.devotees) && sysData.devotees.length > 0
    ? sysData.devotees
    : Array.from({ length: totalDevotees }, () => ({
        status: sysData.status || REGISTRATION_STATUS.PENDING,
        goodieKitIssued: !!sysData.goodieKitIssued,
      }));

  // Exclude empty and internal keys from details table
  const detailEntries = Object.entries(sourceData).filter(([_, v]) =>
    v !== null && v !== undefined && v !== ''
  );

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      isVerified
        ? 'bg-emerald-50/40 border-emerald-200/80'
        : 'bg-white border-stone-200/80 shadow-2xs'
    }`}>
      {/* Clickable Card Header */}
      <div
        onClick={onToggle}
        className="p-4 flex items-start justify-between gap-3 cursor-pointer select-none hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
            isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            <User className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-bold text-stone-900 leading-snug truncate">
                {primaryName}
              </span>
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                {reg._id}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-500 flex-wrap">
              {phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-stone-400" />
                  {phone}
                </span>
              )}
              {totalDevotees > 1 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-[10px]">
                  <Users className="w-2.5 h-2.5" />
                  {totalDevotees} Devotees
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status badges & toggle icon */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {isVerified ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[11px] font-bold text-amber-800">
                <Clock className="w-3 h-3 text-amber-600" />
                Pending
              </span>
            )}
            <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </div>

          {hasGoodie && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold">
              <Gift className="w-2.5 h-2.5" />
              Goodie Issued
            </span>
          )}
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-stone-100/80 text-[12px]">
          {/* Seva Verification & Volunteer Details Banner */}
          <div className="p-3 rounded-xl bg-white border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-stone-500 font-medium">Status &amp; Goodies:</span>
              <span className={`font-semibold flex items-center gap-1 ${isVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isVerified ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Verified &amp; Goodie Issued
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Pending Verification
                  </>
                )}
              </span>
            </div>

            {isVerified && (
              <>
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-stone-100">
                  <span className="text-stone-500 font-medium">Verified By (Volunteer):</span>
                  <span className="font-bold text-emerald-800">
                    {sysData.lastVerifiedByName ||
                     sysData.devotees?.[0]?.verifiedByName ||
                     sysData.verifiedByName ||
                     'Volunteer'}
                  </span>
                </div>
                {(sysData.lastVerifiedAt || sysData.devotees?.[0]?.verifiedAt || sysData.devotees?.[0]?.goodieIssuedAt) && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
                    <span className="text-stone-500 font-medium">Verification Time:</span>
                    <span className="font-semibold text-stone-700">
                      {formatFullTime(
                        sysData.lastVerifiedAt ||
                        sysData.devotees?.[0]?.verifiedAt ||
                        sysData.devotees?.[0]?.goodieIssuedAt
                      )}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Multi-devotee status breakdown if > 1 */}
          {devoteeList.length > 1 && (
            <div className="p-3 rounded-xl bg-white border border-stone-200/80 space-y-2">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Devotee Breakdown ({devoteeList.length})
              </p>
              <div className="divide-y divide-stone-100">
                {devoteeList.map((dev, idx) => {
                  const devVerified = dev.status === REGISTRATION_STATUS.VERIFIED;
                  return (
                    <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-[12px]">
                      <div>
                        <span className="font-semibold text-stone-800">
                          {dev.devoteeName || `Devotee ${idx + 1}`}
                        </span>
                        {devVerified && dev.verifiedByName && (
                          <p className="text-[10px] text-stone-400">
                            By {dev.verifiedByName} {dev.verifiedAt ? `· ${formatFullTime(dev.verifiedAt)}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {dev.goodieKitIssued && (
                          <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-semibold">
                            🎁 Goodie Given
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          devVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {devVerified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Excel Row Details */}
          {detailEntries.length > 0 && (
            <div className="p-3 rounded-xl bg-white border border-stone-200/80 space-y-1.5">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                Registration Form Data
              </p>
              {detailEntries.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 py-1 border-b border-stone-50 last:border-0">
                  <span className="text-stone-500 font-medium text-[11px] shrink-0 min-w-[120px]">
                    {formatLabel(k)}
                  </span>
                  <span className="font-semibold text-stone-800 text-right text-[12px] break-words">
                    {formatValue(v)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action to open full verification view */}
          <button
            onClick={() => navigate(`/registration/${encodeURIComponent(reg._id)}?eventId=${eventId}`)}
            className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            Open Devotee Verification Page
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Modal Component ─────────────────────────────────────────────────────

export default function RegistrationListModal({
  eventId,
  eventName,
  initialTab = 'ALL',
  onClose,
}) {
  const [activeTab, setActiveTab]       = useState(initialTab);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [search, setSearch]             = useState('');
  const [expandedDocId, setExpandedDocId] = useState(null);

  // Load registrations from Firestore
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRegistrations(eventId, 500);
      setRegistrations(data);
    } catch (err) {
      console.error('[RegistrationListModal] load error', err);
      setError('Unable to load registrations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tab counts
  const counts = useMemo(() => {
    let total = registrations.length;
    let verified = 0;
    let pending = 0;

    for (const r of registrations) {
      const sys = r.systemData || {};
      if (sys.status === REGISTRATION_STATUS.VERIFIED || sys.goodieKitIssued) {
        verified++;
      } else {
        pending++;
      }
    }
    return { total, verified, pending };
  }, [registrations]);

  // Filtered registrations
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return registrations.filter((reg) => {
      const sys = reg.systemData || {};
      const isVerified = sys.status === REGISTRATION_STATUS.VERIFIED || sys.goodieKitIssued;

      // Tab filter
      if (activeTab === 'VERIFIED' && !isVerified) return false;
      if (activeTab === 'PENDING' && isVerified) return false;

      // Search filter
      if (!q) return true;

      // Match doc ID
      if (reg._id?.toLowerCase().includes(q)) return true;

      // Match any field in sourceData
      if (reg.sourceData) {
        return Object.values(reg.sourceData).some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        );
      }

      return false;
    });
  }, [registrations, activeTab, search]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAF7F2] font-['Poppins',sans-serif]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-200/70 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-stone-900 truncate">
              Registration Records
            </h2>
            <p className="text-[11px] text-stone-400 mt-0.5 truncate">
              {eventName ? `${eventName} · ` : ''}
              {loading ? 'Loading…' : `${registrations.length} total records`}
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Tabs — 3 Clean Categories */}
      <div className="px-5 py-2.5 bg-white border-b border-stone-100 shrink-0 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Total Registered Devotees ({counts.total})
        </button>
        <button
          onClick={() => setActiveTab('VERIFIED')}
          className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'VERIFIED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Verified &amp; Goodies ({counts.verified})
        </button>
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'PENDING'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Pending ({counts.pending})
        </button>
      </div>

      {/* Search Filter */}
      <div className="px-5 py-3 bg-white border-b border-stone-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by devotee name, phone, pass ID…"
            className="w-full h-11 pl-10 pr-9 text-[13px] bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List / Content Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <p className="text-[13px] font-medium">Loading registrations…</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-[13px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 text-[12px] font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-stone-700">No records found</p>
              <p className="text-[12px] text-stone-400 mt-1">
                {search
                  ? `No registration matches "${search}" in ${activeTab.toLowerCase()} category.`
                  : `No registrations in this category yet.`}
              </p>
            </div>
          </div>
        )}

        {!loading && !error && filtered.map((reg) => (
          <RegistrationItem
            key={reg._id}
            reg={reg}
            eventId={eventId}
            isExpanded={expandedDocId === reg._id}
            onToggle={() => setExpandedDocId((cur) => (cur === reg._id ? null : reg._id))}
          />
        ))}
      </div>
    </div>
  );
}
