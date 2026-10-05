/**
 * QRScanScreen — /scan
 *
 * Flow:
 *  1. Select event (assigned events for agents; all active for admins)
 *  2. Camera scanner (html5-qrcode) OR manual input — same lookup function
 *  3. Lookup registration using event.qrIdentifierColumn + deriveDocId
 *  4. Navigate to /registration/:docId?eventId=...
 *
 * Debounce: once a QR is detected the scanner is paused for 2 s to prevent
 * rapid duplicate scans of the same code.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ArrowLeft, QrCode, Flashlight, FlashlightOff, Search,
  Loader2, AlertCircle, ChevronDown, CameraOff, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { getEvents, getEventById } from '../../services/eventService';
import { getAssignedEventIds } from '../../services/assignmentService';
import { getRegistrationByQrValue } from '../../services/registrationService';
import { USER_ROLES } from '../../types/user';
import { EVENT_STATUSES } from '../../types/event';

// ─── Constants ────────────────────────────────────────────────────────────────
const SCANNER_ELEMENT_ID = 'yatra-qr-scanner';
const SCAN_DEBOUNCE_MS   = 2000;

// ─── Event Selector ───────────────────────────────────────────────────────────
function EventSelector({ events, selectedId, onSelect, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 h-11 rounded-2xl bg-white/10 border border-white/20 text-white/60 text-[13px]">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading events…</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 h-11 rounded-2xl bg-red-900/30 border border-red-500/30 text-red-300 text-[12px]">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>No events assigned. Contact your admin.</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full h-11 pl-4 pr-10 rounded-2xl bg-white/10 border border-white/20 text-white text-[13px] font-medium appearance-none outline-none focus:border-amber-400 focus:bg-white/15 transition-all cursor-pointer"
      >
        <option value="" className="bg-stone-900">— Select Yatra —</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id} className="bg-stone-900">
            {ev.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
    </div>
  );
}

// ─── Camera Scanner ───────────────────────────────────────────────────────────
function CameraScanner({ onDetected, onError, active }) {
  const scannerRef   = useRef(null);
  const debounceRef  = useRef(false);
  const [torch, setTorch] = useState(false);

  useEffect(() => {
    if (!active) return;

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        if (debounceRef.current) return;
        debounceRef.current = true;
        onDetected(decodedText.trim());
        setTimeout(() => { debounceRef.current = false; }, SCAN_DEBOUNCE_MS);
      },
      () => {}, // per-frame errors — ignore
    ).catch((err) => {
      const msg = String(err?.message ?? err);
      if (msg.includes('Permission')) {
        onError('camera_denied');
      } else if (msg.includes('NotFound') || msg.includes('device')) {
        onError('no_camera');
      } else {
        onError('camera_error');
      }
    });

    return () => {
      scanner.isScanning && scanner.stop().catch(() => {});
    };
  }, [active, onDetected, onError]);

  const toggleTorch = async () => {
    try {
      const track = scannerRef.current
        ?.getRunningTrackCapabilities?.()
        ?.torch !== undefined
        ? scannerRef.current.getRunningTrackCameraCapabilities()
        : null;
      if (track) {
        await track.torchFeature().apply(!torch);
        setTorch((v) => !v);
      }
    } catch {
      // torch not supported — ignore silently
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Scanner viewport */}
      <div className="relative w-64 sm:w-72 aspect-square rounded-3xl overflow-hidden border-2 border-amber-400/80 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
        <div id={SCANNER_ELEMENT_ID} className="w-full h-full" />

        {/* Corner guides */}
        {['top-2 left-2 border-t-4 border-l-4 rounded-tl-xl',
          'top-2 right-2 border-t-4 border-r-4 rounded-tr-xl',
          'bottom-2 left-2 border-b-4 border-l-4 rounded-bl-xl',
          'bottom-2 right-2 border-b-4 border-r-4 rounded-br-xl',
        ].map((cls, i) => (
          <div key={i} className={`absolute w-6 h-6 border-amber-400 ${cls}`} />
        ))}

        {/* Scan line */}
        <div className="absolute inset-x-4 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#F59E0B] animate-pulse pointer-events-none" />
      </div>

      {/* Torch toggle */}
      <button
        onClick={toggleTorch}
        className={`mt-4 w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer
          ${torch ? 'bg-amber-400 border-amber-300 text-stone-950' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
        aria-label="Toggle flashlight"
      >
        {torch ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
      </button>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function QRScanScreen() {
  const navigate               = useNavigate();
  const [searchParams]         = useSearchParams();
  const queryEventId           = searchParams.get('eventId');
  const { firebaseUser, role } = useAuth();
  const isSuperAdmin = role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.ADMIN;

  // Events
  const [events, setEvents]         = useState([]);
  const [eventsLoading, setEvLoad]  = useState(true);
  const [selectedEventId, setSelId] = useState('');
  const [selectedEvent, setSelEv]   = useState(null);

  // Scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState(''); // 'camera_denied' | 'no_camera' | 'camera_error'

  // Manual input
  const [manualVal, setManualVal]   = useState('');

  // Lookup state
  const [looking, setLooking]       = useState(false);
  const [lookupError, setLookupErr] = useState('');
  const [found, setFound]           = useState(false);

  // ── Load events ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setEvLoad(true);
      try {
        let evs = [];
        if (isSuperAdmin) {
          const all = await getEvents();
          evs = all.filter((e) => e.status === EVENT_STATUSES.ACTIVE);
        } else {
          const ids     = await getAssignedEventIds(firebaseUser.uid);
          const settled = await Promise.allSettled(ids.map((id) => getEventById(id)));
          evs = settled
            .filter((r) => r.status === 'fulfilled' && r.value)
            .map((r) => r.value)
            .filter((e) => e.status === EVENT_STATUSES.ACTIVE);
        }
        if (!cancelled) {
          setEvents(evs);
          const matched = queryEventId ? evs.find((e) => e.id === queryEventId) : null;
          if (matched) {
            setSelId(matched.id);
            setSelEv(matched);
            setCameraActive(true);
          } else if (evs.length === 1) {
            setSelId(evs[0].id);
            setSelEv(evs[0]);
            setCameraActive(true);
          }
        }
      } catch (err) {
        console.error('[QRScanScreen] load events', err);
      } finally {
        if (!cancelled) setEvLoad(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isSuperAdmin, firebaseUser?.uid, queryEventId]);

  const handleEventSelect = (id) => {
    setSelId(id);
    setSelEv(events.find((e) => e.id === id) ?? null);
    setCameraActive(false);
    setLookupErr('');
    setFound(false);
  };

  // ── Core lookup ─────────────────────────────────────────────────────────
  const lookup = useCallback(async (rawValue) => {
    if (!selectedEvent) { setLookupErr('Please select a Yatra first.'); return; }
    if (!rawValue.trim()) return;

    const qrCol = selectedEvent.qrIdentifierColumn;
    if (!qrCol) {
      setLookupErr('This event has no QR identifier column configured. Import registrations first.');
      return;
    }

    setLooking(true);
    setLookupErr('');
    setFound(false);
    setCameraActive(false);

    try {
      const reg = await getRegistrationByQrValue(selectedEvent.id, rawValue.trim());
      if (!reg) {
        setLookupErr(`No registration found for "${rawValue.trim()}". Check that this QR belongs to the selected Yatra.`);
        setLooking(false);
        return;
      }
      setFound(true);
      // Navigate — pass eventId as search param
      const docId = reg._id ?? reg.systemData?.docId;
      setTimeout(() => {
        navigate(`/registration/${encodeURIComponent(docId)}?eventId=${selectedEvent.id}`);
      }, 400); // brief "found" flash
    } catch (err) {
      console.error('[QRScanScreen] lookup', err);
      setLookupErr('Lookup failed. Check your connection and try again.');
    } finally {
      setLooking(false);
    }
  }, [selectedEvent, navigate]);

  const handleCameraDetect = useCallback((val) => { lookup(val); }, [lookup]);
  const handleManualSubmit  = (e) => { e?.preventDefault(); lookup(manualVal); };

  const cameraErrorMsg = {
    camera_denied: 'Camera permission denied. Use manual input below.',
    no_camera:     'No camera detected on this device. Use manual input below.',
    camera_error:  'Camera failed to start. Use manual input below.',
  }[cameraError] ?? '';

  return (
    <div className="flex flex-col min-h-screen bg-stone-950 text-white select-none font-['Poppins',sans-serif]">

      {/* Header */}
      <header className="pt-4 px-5 flex items-center justify-between shrink-0 z-20">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="text-[16px] font-bold tracking-tight">QR Gate Scanner</h1>
          <p className="text-[11px] text-stone-400">Scan the registration QR to verify devotees</p>
        </div>
        <div className="w-10" /> {/* spacer */}
      </header>

      {/* Event selector */}
      <div className="px-5 pt-4 pb-2 shrink-0">
        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">Select Yatra</p>
        <EventSelector
          events={events}
          selectedId={selectedEventId}
          onSelect={handleEventSelect}
          loading={eventsLoading}
        />
        {selectedEvent?.qrIdentifierColumn && (
          <p className="mt-1.5 text-[11px] text-stone-500">
            QR column: <span className="font-mono text-amber-400">{selectedEvent.qrIdentifierColumn}</span>
          </p>
        )}
      </div>

      {/* Scanner viewport */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-4 relative">
        <div className="absolute inset-0 bg-stone-900/90" />

        {looking && (
          <div className="relative z-10 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
            <p className="text-[14px] font-medium text-stone-300">Finding registration…</p>
          </div>
        )}

        {found && !looking && (
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            </div>
            <p className="text-[14px] font-semibold text-emerald-300">Registration found!</p>
          </div>
        )}

        {!looking && !found && (
          <>
            {cameraActive && !cameraError ? (
              <div className="relative z-10">
                <CameraScanner
                  onDetected={handleCameraDetect}
                  onError={setCameraError}
                  active={cameraActive}
                />
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center gap-4">
                {cameraError ? (
                  <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                    <CameraOff className="w-8 h-8 text-red-400" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <QrCode className="w-8 h-8 text-amber-400" />
                  </div>
                )}
                <button
                  onClick={() => {
                    if (!selectedEventId) { setLookupErr('Please select a Yatra first.'); return; }
                    setCameraError('');
                    setLookupErr('');
                    setCameraActive(true);
                  }}
                  disabled={!selectedEventId}
                  className="inline-flex items-center gap-2 px-6 h-12 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-semibold text-[14px] disabled:opacity-50 cursor-pointer transition-all shadow-lg shadow-amber-900/30"
                >
                  <QrCode className="w-4 h-4" />
                  {cameraError ? 'Retry Camera' : 'Start Camera'}
                </button>
                {cameraError && (
                  <p className="text-[12px] text-red-400 text-center max-w-xs">{cameraErrorMsg}</p>
                )}
              </div>
            )}
          </>
        )}

        {lookupError && (
          <div className="absolute bottom-4 left-5 right-5 z-20 flex items-start gap-2 p-3.5 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-300 text-[12px] backdrop-blur-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div>
              <p className="font-semibold text-red-200">Not Found</p>
              <p className="mt-0.5">{lookupError}</p>
              <button
                onClick={() => { setLookupErr(''); setCameraActive(!!selectedEventId); }}
                className="mt-2 text-amber-400 font-semibold underline cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom sheet — manual input + quick test buttons */}
      <div className="shrink-0 bg-stone-900/95 backdrop-blur-lg border-t border-white/10 rounded-t-[28px] px-5 pt-5 pb-7 space-y-4 z-20">

        {/* Manual input */}
        <div>
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
            Manual QR Input
          </p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={manualVal}
                onChange={(e) => setManualVal(e.target.value)}
                placeholder="Enter QR value…"
                className="w-full h-11 pl-9 pr-3 bg-stone-800 text-white placeholder:text-stone-500 rounded-xl border border-stone-700 text-[14px] font-mono uppercase outline-none focus:border-amber-400"
              />
            </div>
            <button
              type="submit"
              disabled={!manualVal.trim() || looking || !selectedEventId}
              className="px-4 h-11 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[13px] rounded-xl disabled:opacity-50 cursor-pointer transition-colors shrink-0"
            >
              Find
            </button>
          </form>
        </div>

        {/* Quick test chips — only show if event has registrations */}
        {selectedEvent && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-stone-500 shrink-0">Quick test:</span>
            {['YAT-001', 'YAT-002', 'YAT-003'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => lookup(v)}
                disabled={looking}
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 font-mono text-[11px] cursor-pointer transition-colors disabled:opacity-50"
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
