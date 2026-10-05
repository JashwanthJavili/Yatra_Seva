/**
 * RegistrationDetailsScreen — /registration/:docId?eventId=...
 *
 * - Real-time Firestore listener (onSnapshot) — reflects other volunteers' actions instantly
 * - Dynamic sourceData display — renders whatever columns came from Excel
 * - Individual devotee verification cards with atomic "Give Goodie" confirm modal
 * - Duplicate detection — shows who already verified a devotee
 * - Never modifies sourceData
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, QrCode, Loader2, AlertCircle, CheckCircle2,
  Gift, User, Clock, ShieldCheck, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { watchRegistration } from '../services/registrationService';
import { verifyDevotee, extractDevoteeName } from '../services/verificationService';
import { getEventById }      from '../services/eventService';
import { REGISTRATION_STATUS } from '../types/registration';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function formatTs(ts) {
  if (!ts) return '';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

function formatFullTime(ts) {
  if (!ts) return '—';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch { return '—'; }
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ devoteeName, onConfirm, onCancel, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-stone-900">Confirm Verification</h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer hover:bg-stone-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
          <p className="text-[13px] text-stone-700 leading-relaxed">
            Give goodie to <span className="font-bold text-stone-900">{devoteeName}</span>?
          </p>
          <p className="text-[11px] text-amber-700 mt-1">This action will be recorded and cannot be undone.</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 h-11 rounded-2xl border border-stone-200 text-stone-600 text-[14px] font-medium hover:bg-stone-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-[2] h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer shadow-md shadow-amber-900/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Gift className="w-4 h-4" />Confirm</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Devotee Card ─────────────────────────────────────────────────────────────

function DevoteeCard({ index, label, devState, sourceData, isExpanded, onToggle, onGiveGoodie, confirmingIndex, totalDevotees }) {
  const isVerified   = devState?.status === REGISTRATION_STATUS.VERIFIED;
  const isPending    = !isVerified;
  const isConfirming = confirmingIndex === index;

  // Filter devotee-relevant fields from sourceData
  const detailEntries = Object.entries(sourceData ?? {}).filter(([k, v]) => {
    if (v === null || v === undefined || v === '') return false;
    const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (index === 0) {
      return !/[2-9]/.test(lower);
    } else {
      return lower.includes(String(index + 1));
    }
  });

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden
      ${isVerified ? 'bg-emerald-50/70 border-emerald-200' : 'bg-white border-stone-200/80 shadow-2xs'}`}
    >
      {/* Clickable Header — toggles expand */}
      <div
        onClick={onToggle}
        className="p-4 flex items-center justify-between gap-2 cursor-pointer select-none hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
            ${isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-stone-900 leading-tight truncate">{label}</p>
            {totalDevotees > 1 && (
              <p className="text-[11px] text-stone-400 mt-0.5">Devotee {index + 1}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isVerified ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-[11px] font-bold text-amber-800">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Pending
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-stone-100 text-[12px]">
          {/* Verification & Goodie status banner */}
          <div className="p-3 rounded-xl bg-white border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-stone-500 font-medium">Goodie Kit:</span>
              <span className={`font-semibold flex items-center gap-1 ${isVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                <Gift className="w-3.5 h-3.5" />
                {isVerified ? 'Goodie Received' : 'Pending Handover'}
              </span>
            </div>

            {isVerified && (
              <>
                <div className="flex items-start justify-between gap-2 pt-1.5 border-t border-stone-100">
                  <span className="text-stone-500 font-medium">Received At:</span>
                  <span className="font-semibold text-stone-900 text-right">
                    {formatFullTime(devState?.goodieIssuedAt || devState?.verifiedAt)}
                  </span>
                </div>
                {devState?.verifiedByName && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
                    <span className="text-stone-500 font-medium">Verified By:</span>
                    <span className="font-semibold text-emerald-800">
                      {devState.verifiedByName}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Devotee information fields */}
          {detailEntries.length > 0 && (
            <div className="p-3 rounded-xl bg-white border border-stone-200/80 space-y-1.5">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Devotee Information</p>
              {detailEntries.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-2 py-1 border-b border-stone-50 last:border-0">
                  <span className="text-stone-500 font-medium text-[11px]">{formatLabel(k)}:</span>
                  <span className="font-semibold text-stone-800 text-right text-[12px] break-words">{formatValue(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Give Goodie Action (when pending) */}
      {isPending && (
        <div className="px-4 pb-4 pt-1">
          <button
            onClick={() => onGiveGoodie(index)}
            disabled={isConfirming}
            className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer transition-all shadow-md shadow-amber-900/15"
          >
            {isConfirming
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Gift className="w-4 h-4" />Give Goodie</>
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Source Data Fields ───────────────────────────────────────────────────────

function SourceDataFields({ sourceData, qrIdentifierColumn }) {
  const entries = Object.entries(sourceData ?? {});
  if (entries.length === 0) return <p className="text-[13px] text-stone-400 italic">No source data.</p>;

  const sorted = [
    ...entries.filter(([k]) => k === qrIdentifierColumn),
    ...entries.filter(([k]) => k !== qrIdentifierColumn),
  ];

  return (
    <div className="divide-y divide-stone-100">
      {sorted.map(([key, value]) => (
        <div key={key} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <span className="text-[11px] font-semibold text-stone-500 shrink-0 min-w-[110px] pt-0.5">
            {formatLabel(key)}
            {key === qrIdentifierColumn && (
              <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded-full align-middle">
                ID
              </span>
            )}
          </span>
          <span className="text-[13px] text-stone-800 font-medium text-right break-words">
            {formatValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RegistrationDetailsScreen() {
  const { docId }          = useParams(); // URL-encoded Firestore doc ID
  const [searchParams]     = useSearchParams();
  const navigate           = useNavigate();
  const { firebaseUser, userProfile } = useAuth();

  const eventId            = searchParams.get('eventId') ?? '';
  const decodedDocId       = decodeURIComponent(docId ?? '');

  const [regDoc, setRegDoc]       = useState(null);
  const [event, setEvent]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [expandedIndex, setExpandedIndex] = useState(0);

  // Confirm modal state
  const [confirmIdx, setConfirmIdx] = useState(null); // devotee index awaiting confirm
  const [saving, setSaving]         = useState(false);
  const [actionError, setActionErr] = useState('');
  const [toastMsg, setToastMsg]     = useState('');

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  // ── Load event metadata ────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) { setError('No event context. Navigate from the scan page.'); setLoading(false); return; }
    getEventById(eventId)
      .then((ev) => { if (ev) setEvent(ev); else setError('Event not found.'); })
      .catch(() => setError('Failed to load event.'));
  }, [eventId]);

  // ── Real-time registration listener ───────────────────────────────────
  useEffect(() => {
    if (!eventId || !decodedDocId) { setLoading(false); return; }

    setLoading(true);
    setError('');

    const unsub = watchRegistration(
      eventId,
      decodedDocId,
      (doc) => {
        if (!doc) {
          setError(`No registration found for: ${decodedDocId}`);
        } else {
          setRegDoc(doc);
          setError('');
        }
        setLoading(false);
      },
      (err) => {
        console.error('[RegistrationDetailsScreen] listener', err);
        setError('Failed to load registration. Check your connection.');
        setLoading(false);
      },
    );

    return unsub; // cleanup on unmount or docId change
  }, [eventId, decodedDocId]);

  // ── Devotee labels ─────────────────────────────────────────────────────
  // Robust name extraction from sourceData; also respects existing verified name
  const getDevoteeName = useCallback((index, sourceData, devState = null) => {
    if (devState?.devoteeName && !devState.devoteeName.startsWith('Devotee')) {
      return String(devState.devoteeName).trim();
    }
    const extracted = extractDevoteeName(index, sourceData);
    if (extracted) return extracted;
    return `Devotee ${index + 1}`;
  }, []);

  // ── Give Goodie ────────────────────────────────────────────────────────
  const handleGiveGoodie = async (devoteeIndex) => {
    if (!regDoc || !event) return;
    setSaving(true);
    setActionErr('');

    const sysData       = regDoc.systemData ?? {};
    const totalDevotees = resolveTotalDevotees(regDoc.sourceData, sysData);

    try {
      const devoteeName = getDevoteeName(devoteeIndex, regDoc.sourceData, sysData.devotees?.[devoteeIndex]);
      const result = await verifyDevotee({
        eventId,
        docId:          decodedDocId,
        devoteeIndex,
        devoteeName,
        performedBy:    firebaseUser?.uid,
        performedByName: userProfile?.name ?? firebaseUser?.email ?? 'Unknown',
        totalDevotees,
      });

      if (result.alreadyVerified) {
        showToast('This devotee was already verified by another volunteer.');
      } else {
        showToast('Goodie issued and verification recorded.');
      }
    } catch (err) {
      console.error('[handleGiveGoodie]', err);
      setActionErr('Verification failed. Please try again.');
    } finally {
      setSaving(false);
      setConfirmIdx(null);
    }
  };

  // ── Back Navigation ───────────────────────────────────────────────────
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (eventId) {
      navigate(`/events/${eventId}`);
    } else {
      navigate('/dashboard');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-[#FAF7F2]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-amber-600" />
          <p className="text-[12px] text-stone-400 font-medium">Loading registration…</p>
        </div>
      </div>
    );
  }

  if (error && !regDoc) {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center gap-4 bg-[#FAF7F2] px-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <p className="text-[15px] font-bold text-stone-800">Registration Not Found</p>
          <p className="text-[13px] text-stone-500 mt-1">{error}</p>
        </div>
        <button
          onClick={() => navigate('/scan')}
          className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-amber-600 text-white text-[13px] font-semibold cursor-pointer"
        >
          <QrCode className="w-4 h-4" />Try Again
        </button>
      </div>
    );
  }

  const sourceData = regDoc?.sourceData ?? {};
  const sysData    = regDoc?.systemData ?? {};
  const qrCol      = sysData.qrIdentifierColumn ?? event?.qrIdentifierColumn ?? '';

  // Helper to determine total devotees
  function resolveTotalDevotees(source, sys) {
    if (Array.isArray(sys?.devotees) && sys.devotees.length > 0) {
      return sys.devotees.length;
    }
    if (!source) return 1;
    const entries = Object.entries(source);
    const countEntry = entries.find(([k, v]) => {
      if (v === null || v === undefined || v === '') return false;
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        norm.includes('totaldevotee') ||
        norm.includes('totalmember') ||
        norm.includes('totalperson') ||
        norm.includes('noofdevotee') ||
        norm.includes('numberofdevotee') ||
        norm.includes('noofperson') ||
        norm.includes('devoteecount') ||
        norm.includes('membercount') ||
        norm === 'devotees' ||
        norm === 'persons' ||
        norm === 'members'
      );
    });
    if (countEntry && !isNaN(Number(countEntry[1])) && Number(countEntry[1]) > 0) {
      return Number(countEntry[1]);
    }
    let maxNumbered = 1;
    for (const [k, v] of entries) {
      if (v === null || v === undefined || v === '') continue;
      const match = k.match(/(?:devotee|person|member|passenger|participant|name)[\s_-]*([2-9]|\d{2})/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNumbered && num <= 50) maxNumbered = num;
      }
    }
    return maxNumbered;
  }

  const totalDevotees = resolveTotalDevotees(sourceData, sysData);
  const devoteeStates = Array.isArray(sysData.devotees)
    ? sysData.devotees
    : Array.from({ length: totalDevotees }, () => ({ status: REGISTRATION_STATUS.PENDING, goodieKitIssued: false }));

  const overallVerified = sysData.status === REGISTRATION_STATUS.VERIFIED;
  const qrDisplayValue  = sourceData[qrCol] ?? decodedDocId;

  return (
    <>
      {/* Confirm modal */}
      {confirmIdx !== null && (
        <ConfirmModal
          devoteeName={getDevoteeName(confirmIdx, sourceData)}
          onConfirm={() => handleGiveGoodie(confirmIdx)}
          onCancel={() => { setConfirmIdx(null); setActionErr(''); }}
          saving={saving}
        />
      )}

      <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F3ECE0] text-stone-800 select-none font-['Poppins',sans-serif]">

        {/* Header */}
        <header className="pt-4 px-6 flex items-center justify-between shrink-0 z-10">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-white border border-stone-200 shadow-xs flex items-center justify-center text-stone-600 hover:text-amber-800 active:scale-95 transition-all cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-widest">Devotee Verification</span>
            <div className="font-mono text-[13px] font-bold text-amber-900 truncate max-w-[160px]">
              {String(qrDisplayValue).toUpperCase()}
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-amber-900 text-[12px] font-medium shadow-2xs cursor-pointer"
          >
            Home
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 px-5 pt-4 pb-10 overflow-y-auto max-w-lg mx-auto w-full space-y-4">

          {/* Toast */}
          {toastMsg && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />{toastMsg}
            </div>
          )}

          {/* Action error */}
          {actionError && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-[12px] font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />{actionError}
            </div>
          )}

          {/* Real-time indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">Live — updates in real time</span>
            {overallVerified && (
              <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 font-bold">
                <CheckCircle2 className="w-3 h-3" />All Verified
              </span>
            )}
          </div>

          {/* Source data card */}
          <div className="bg-white border border-stone-200/80 rounded-2xl p-5">
            <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-3">
              Registration Details
              {event?.name && <span className="ml-2 text-amber-600 normal-case">· {event.name}</span>}
            </p>
            <SourceDataFields sourceData={sourceData} qrIdentifierColumn={qrCol} />
          </div>

          {/* Devotee verification cards */}
          <div>
            <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2.5">
              {totalDevotees > 1 ? `Devotees (${totalDevotees})` : 'Devotee Verification'}
            </p>
            <div className="space-y-3">
              {Array.from({ length: Math.max(totalDevotees, devoteeStates.length) }, (_, i) => (
                <DevoteeCard
                  key={i}
                  index={i}
                  label={getDevoteeName(i, sourceData, devoteeStates[i])}
                  devState={devoteeStates[i] ?? { status: REGISTRATION_STATUS.PENDING, goodieKitIssued: false }}
                  sourceData={sourceData}
                  isExpanded={expandedIndex === i}
                  onToggle={() => setExpandedIndex((cur) => (cur === i ? null : i))}
                  onGiveGoodie={(idx) => setConfirmIdx(idx)}
                  confirmingIndex={confirmIdx}
                  totalDevotees={totalDevotees}
                />
              ))}
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex gap-2">
            <button
              onClick={handleBack}
              className="flex-1 h-12 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold text-[13px] rounded-2xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
            >
              <ArrowLeft className="w-4 h-4 text-stone-500" />Back
            </button>
            <button
              onClick={() => navigate('/scan')}
              className="flex-[2] h-12 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 font-semibold text-[13px] rounded-2xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
            >
              <QrCode className="w-4 h-4 text-stone-600" />Scan Another QR
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
