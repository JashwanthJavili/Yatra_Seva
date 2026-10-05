/**
 * RegistrationImport — dynamic Excel import & synchronization modal.
 *
 * Flow:
 *  1. File picker (with existing data safety awareness) → parseExcelFile()
 *  2. Column info screen — shows detected columns, asks admin to pick QR identifier
 *  3. classifyRows() — validate + detect in-file duplicates using chosen column
 *  4. Preview table & Security Re-sync Check — dynamic columns, safety checklist
 *  5. Import / Sync → importRegistrations() → result screen with precise terms
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2,
  Loader2, ChevronDown, ChevronUp, ArrowLeft,
  Users, SkipForward, AlertTriangle, Tag, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { parseExcelFile, classifyRows } from '../../services/excelService';
import { importRegistrations } from '../../services/registrationService';
import { updateEventQrColumn } from '../../services/eventService';

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEP = {
  PICK:      'pick',
  PARSING:   'parsing',
  QR_SELECT: 'qr_select',
  PREVIEW:   'preview',
  IMPORTING: 'importing',
  DONE:      'done',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtSize(kb) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function StatPill({ icon: Icon, label, value, colour }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${colour}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div>
        <div className="text-[16px] font-bold leading-none">{value}</div>
        <div className="text-[11px] font-medium opacity-80 leading-tight">{label}</div>
      </div>
    </div>
  );
}

// ─── Step 1: File Picker ──────────────────────────────────────────────────────
function FilePicker({ onFile, parseError, existingStats }) {
  const inputRef        = useRef(null);
  const [drag, setDrag] = useState(false);

  const hasExistingData = (existingStats?.total ?? 0) > 0;

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      onFile(null, 'Only .xlsx and .xls files are supported.');
      return;
    }
    onFile(f, null);
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-8">
      {/* Existing Data Notice Banner */}
      {hasExistingData && (
        <div className="w-full max-w-md mb-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-stone-800 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-bold text-amber-950">
                Active Registration Dataset Detected
              </p>
              <p className="text-[12px] text-stone-700 mt-1 leading-relaxed">
                This Yatra currently has <strong className="text-stone-900">{existingStats.total} devotees</strong> registered (
                <span className="text-emerald-700 font-semibold">{existingStats.verified ?? existingStats.goodiesIssued ?? 0} verified</span>,{' '}
                <span className="text-amber-700 font-semibold">{existingStats.pending ?? 0} pending</span>).
              </p>
              <div className="mt-3 pt-2.5 border-t border-amber-200/80 space-y-1.5 text-[11px] text-stone-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-700 font-bold">✓</span>
                  <span><strong>Verified devotees protected:</strong> Already scanned/verified devotees will never be overwritten.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sky-700 font-bold">↻</span>
                  <span><strong>Pending data synced:</strong> Devotees waiting for verification will be updated with this file.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-700 font-bold">+</span>
                  <span><strong>New devotees added:</strong> New rows found in the sheet will be created.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-md border-2 border-dashed rounded-2xl flex flex-col items-center gap-4 py-10 px-6 cursor-pointer transition-all
          ${drag ? 'border-amber-500 bg-amber-50' : 'border-stone-300 bg-white hover:border-amber-400 hover:bg-amber-50/40'}`}
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
          <FileSpreadsheet className="w-7 h-7 text-amber-600" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-stone-800">
            {hasExistingData ? 'Drop updated Excel file to sync' : 'Drop your Excel file here'}
          </p>
          <p className="text-[12px] text-stone-500 mt-1">or click to browse · .xlsx / .xls</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-4 h-9 rounded-xl bg-amber-600 text-white text-[13px] font-semibold shadow-xs">
          <Upload className="w-3.5 h-3.5" />
          {hasExistingData ? 'Select Updated File' : 'Select File'}
        </div>
      </div>

      {parseError && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px] w-full max-w-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{parseError}</span>
        </div>
      )}

      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />

      <p className="mt-6 text-[11px] text-stone-400 text-center max-w-sm">
        The file is parsed locally in your browser. Devotee records are securely synchronized directly to Firestore.
      </p>
    </div>
  );
}

// ─── Step 2: QR Column Selector ───────────────────────────────────────────────
function QrColumnSelector({ parseResult, existingQrColumn, onConfirm }) {
  const [selected, setSelected] = useState(existingQrColumn || '');

  return (
    <div className="px-6 py-5 max-w-lg mx-auto space-y-5">
      {/* File summary */}
      <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-stone-800 truncate">{parseResult.fileName}</p>
          <p className="text-[11px] text-stone-500">
            {fmtSize(parseResult.fileSizeKB)} · Sheet: <span className="font-medium">{parseResult.sheetName}</span> · {parseResult.totalRows} rows
          </p>
        </div>
      </div>

      {/* Detected columns */}
      <div>
        <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Detected Columns ({parseResult.columns.length})
        </p>
        <div className="bg-white border border-stone-200/80 rounded-2xl overflow-hidden divide-y divide-stone-100 max-h-48 overflow-y-auto">
          {parseResult.columns.map((col, i) => (
            <div key={i} className="flex items-center gap-2.5 px-4 py-2">
              <span className="w-5 h-5 rounded-md bg-stone-100 text-stone-500 text-[11px] font-mono flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-[13px] font-medium text-stone-800 font-mono truncate">{col}</span>
            </div>
          ))}
        </div>
      </div>

      {/* QR column picker */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
        <div className="flex items-start gap-2">
          <Tag className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-amber-900">Select Registration ID / QR Column</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Which column contains the unique Registration ID that matches the devotee's QR pass?
            </p>
          </div>
        </div>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full h-11 px-3.5 text-[14px] bg-white text-stone-800 rounded-xl border border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none cursor-pointer"
        >
          <option value="">— Choose column —</option>
          {parseResult.columns.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>

      <button
        onClick={() => selected && onConfirm(selected)}
        disabled={!selected}
        className="w-full h-12 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-colors shadow-md shadow-amber-900/20"
      >
        Continue to Preview &amp; Safety Check →
      </button>
    </div>
  );
}

// ─── Step 3: Preview Table ────────────────────────────────────────────────────
const ROW_STATE_STYLE = {
  valid:     { row: '',              badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  invalid:   { row: 'bg-red-50/50',  badge: 'bg-red-100 text-red-700 border-red-200' },
  duplicate: { row: 'bg-amber-50/50', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
};

function PreviewTable({ parseResult, qrColumn, showAll, onToggleAll }) {
  const allCols    = parseResult.columns;
  const previewCols = [
    qrColumn,
    ...allCols.filter((c) => c !== qrColumn),
  ].slice(0, 6);

  const rows = showAll ? parseResult.rows : parseResult.rows.slice(0, 25);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-3 py-2.5 font-semibold text-stone-500 whitespace-nowrap">#</th>
              <th className="text-left px-3 py-2.5 font-semibold text-stone-500 whitespace-nowrap">Status</th>
              {previewCols.map((col) => (
                <th key={col} className={`text-left px-3 py-2.5 font-semibold whitespace-nowrap ${col === qrColumn ? 'text-amber-700' : 'text-stone-500'}`}>
                  {col}{col === qrColumn ? ' ★' : ''}
                </th>
              ))}
              <th className="text-left px-3 py-2.5 font-semibold text-stone-500 whitespace-nowrap">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const style = ROW_STATE_STYLE[row.state] ?? ROW_STATE_STYLE.valid;
              return (
                <tr key={row.rowIndex} className={`border-b border-stone-100 last:border-0 ${style.row}`}>
                  <td className="px-3 py-2 text-stone-400 font-mono">{row.rowIndex}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.badge}`}>
                      {row.state}
                    </span>
                  </td>
                  {previewCols.map((col) => (
                    <td key={col} className="px-3 py-2 text-stone-700 whitespace-nowrap max-w-[140px] truncate font-mono text-[11px]">
                      {row.sourceData?.[col] !== undefined && row.sourceData?.[col] !== null
                        ? String(row.sourceData[col])
                        : <span className="text-stone-300">—</span>
                      }
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {row.errors.length > 0
                      ? <span className="text-red-600 text-[11px]">{row.errors[0]}</span>
                      : <span className="text-stone-300">—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {parseResult.rows.length > 25 && (
        <button onClick={onToggleAll} className="mt-2 w-full text-center text-[12px] font-semibold text-amber-700 flex items-center justify-center gap-1 cursor-pointer py-1">
          {showAll
            ? <><ChevronUp className="w-3.5 h-3.5" />Show less</>
            : <><ChevronDown className="w-3.5 h-3.5" />Show all {parseResult.rows.length} rows</>
          }
        </button>
      )}
    </div>
  );
}

// ─── Import Result Screen ─────────────────────────────────────────────────────
function ImportResult({ result, hasExistingData, onClose }) {
  const hasErrors = result.errors > 0;

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 text-center max-w-md mx-auto w-full">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${hasErrors ? 'bg-amber-100' : 'bg-emerald-100'}`}>
        {hasErrors
          ? <AlertTriangle className="w-8 h-8 text-amber-600" />
          : <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        }
      </div>

      <h2 className="text-[18px] font-bold text-stone-900 mb-1">
        {hasExistingData ? 'Synchronization Complete' : 'Import Complete'}
      </h2>
      <p className="text-[13px] text-stone-500 mb-6">
        Devotee registration records have been processed:
      </p>

      <div className="w-full space-y-0 mb-6 border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        {[
          { label: 'Rows in Excel File',                    value: result.attempted,       colour: 'text-stone-800' },
          { label: 'New Devotees Added',                   value: result.imported,        colour: 'text-emerald-700' },
          { label: 'Pending Devotees Updated',             value: result.updated,         colour: 'text-sky-700' },
          { label: 'Verified Devotees Protected (Untouched)', value: result.skippedVerified, colour: 'text-amber-700' },
          { label: 'Invalid / Skipped Rows',               value: result.errors,          colour: 'text-red-700' },
        ].map(({ label, value, colour }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-stone-100 last:border-0 text-left">
            <span className="text-[13px] text-stone-600 pr-2">{label}</span>
            <span className={`text-[15px] font-bold shrink-0 ${colour}`}>{value}</span>
          </div>
        ))}
      </div>

      {result.errorMessages?.length > 0 && (
        <div className="w-full text-left bg-red-50 border border-red-200 rounded-xl p-3 mb-6">
          <p className="text-[11px] font-semibold text-red-700 mb-1.5">Issues detected:</p>
          {result.errorMessages.slice(0, 5).map((m, i) => (
            <p key={i} className="text-[11px] text-red-600">{m}</p>
          ))}
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full h-12 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-[14px] font-semibold cursor-pointer transition-colors shadow-sm"
      >
        Done &amp; Return to Yatra Overview
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
/**
 * @param {{
 *   eventId: string,
 *   eventName: string,
 *   existingQrColumn: string|null,
 *   existingStats?: { total: number, verified: number, pending: number }|null,
 *   onClose: ()=>void,
 *   onImported: ()=>void
 * }} props
 */
export default function RegistrationImport({
  eventId,
  eventName,
  existingQrColumn,
  existingStats,
  onClose,
  onImported,
}) {
  const { firebaseUser } = useAuth();

  const hasExistingData = (existingStats?.total ?? 0) > 0;

  const [step, setStep]                       = useState(STEP.PICK);
  const [parseError, setParseError]           = useState('');
  const [parseResult, setParseResult]         = useState(null);
  const [qrColumn, setQrColumn]               = useState(existingQrColumn || '');
  const [importResult, setImportResult]       = useState(null);
  const [showAllRows, setShowAllRows]         = useState(false);
  const [importError, setImportError]         = useState('');
  const [confirmedSafety, setConfirmedSafety] = useState(false);

  // ── File selected ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file, fileError) => {
    if (fileError) { setParseError(fileError); return; }
    setParseError('');
    setStep(STEP.PARSING);
    try {
      const result = await parseExcelFile(file);
      setParseResult(result);
      setStep(STEP.QR_SELECT);
    } catch (err) {
      console.error('[RegistrationImport] parse', err);
      setParseError(err.message || 'Failed to parse the file.');
      setStep(STEP.PICK);
    }
  }, []);

  // ── QR column confirmed ────────────────────────────────────────────────────
  const handleQrColumnConfirm = useCallback((col) => {
    setQrColumn(col);
    // Classify rows now that we know the QR column
    const classified = classifyRows(parseResult, col);
    setParseResult({ ...classified });
    setStep(STEP.PREVIEW);
  }, [parseResult]);

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!parseResult || !qrColumn) return;
    if (hasExistingData && !confirmedSafety) return;

    setImportError('');
    setStep(STEP.IMPORTING);

    const validRows = parseResult.rows
      .filter((r) => r.state === 'valid')
      .map((r) => r.sourceData);

    try {
      // Save the QR column choice on the event
      await updateEventQrColumn(eventId, qrColumn);
      // Import the rows safely
      const result = await importRegistrations(eventId, qrColumn, validRows, firebaseUser?.uid);
      setImportResult(result);
      setStep(STEP.DONE);
      onImported();
    } catch (err) {
      console.error('[RegistrationImport] import', err);
      setImportError('Import failed. Please check your connection and try again.');
      setStep(STEP.PREVIEW);
    }
  }, [parseResult, qrColumn, hasExistingData, confirmedSafety, eventId, firebaseUser, onImported]);

  const canGoBack = step === STEP.PREVIEW || step === STEP.QR_SELECT;

  const handleBack = () => {
    if (step === STEP.PREVIEW)   { setStep(STEP.QR_SELECT); return; }
    if (step === STEP.QR_SELECT) { setParseResult(null); setStep(STEP.PICK); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAF7F2] font-['Poppins',sans-serif] overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-4 border-b border-stone-200/70 bg-white shadow-2xs">
        {canGoBack && (
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-stone-900">
            {hasExistingData ? 'Update & Sync Devotee Registrations' : 'Import Devotee Registrations'}
          </h2>
          <p className="text-[12px] text-stone-500 truncate">{eventName}</p>
        </div>
        {step !== STEP.IMPORTING && (
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col">

        {step === STEP.PICK && (
          <FilePicker
            onFile={handleFile}
            parseError={parseError}
            existingStats={existingStats}
          />
        )}

        {step === STEP.PARSING && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <p className="text-[13px] font-medium text-stone-600">Reading and validating Excel file…</p>
          </div>
        )}

        {step === STEP.QR_SELECT && parseResult && (
          <QrColumnSelector
            parseResult={parseResult}
            existingQrColumn={existingQrColumn}
            onConfirm={handleQrColumnConfirm}
          />
        )}

        {step === STEP.PREVIEW && parseResult && (
          <div className="px-5 py-5 max-w-4xl mx-auto w-full space-y-5">
            {/* Validation summary */}
            <div>
              <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2.5">
                File Rows Summary
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatPill icon={Users}        label="Total rows in file" value={parseResult.totalRows}     colour="border-stone-200 bg-white text-stone-700" />
                <StatPill icon={CheckCircle2} label="Valid rows"         value={parseResult.validCount}    colour="border-emerald-200 bg-emerald-50 text-emerald-800" />
                <StatPill icon={AlertCircle}  label="Invalid rows"       value={parseResult.invalidCount}  colour="border-red-200 bg-red-50 text-red-800" />
                <StatPill icon={SkipForward}  label="In-file duplicates" value={parseResult.duplicateCount} colour="border-amber-200 bg-amber-50 text-amber-800" />
              </div>
            </div>

            {/* QR column identifier */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12px]">
              <Tag className="w-4 h-4 shrink-0" />
              <span>Registration ID column: <strong className="font-mono">{qrColumn}</strong></span>
            </div>

            {/* Re-sync Security and Protection Banner */}
            {hasExistingData && (
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 space-y-3 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[13px] font-bold text-amber-950">
                      Security Check &amp; Re-sync Protection
                    </h4>
                    <p className="text-[12px] text-stone-700 mt-1 leading-relaxed">
                      This event has <strong className="text-stone-900">{existingStats?.total} existing devotees</strong>. Here is how your data will be handled:
                    </p>
                    <ul className="mt-2 space-y-1.5 text-[11px] text-stone-700 list-disc list-inside">
                      <li>
                        <strong>Verified Devotees Protected:</strong>{' '}
                        <span className="text-emerald-700 font-semibold">{existingStats?.verified ?? existingStats?.goodiesIssued ?? 0} verified record(s)</span> will remain completely untouched.
                      </li>
                      <li>
                        <strong>Pending Devotees Updated:</strong> Devotee entries waiting for verification will be updated with the latest Excel values.
                      </li>
                      <li>
                        <strong>New Registrations:</strong> New devotees in this Excel sheet will be added as pending registrations.
                      </li>
                    </ul>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 pt-3 border-t border-amber-200/80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmedSafety}
                    onChange={(e) => setConfirmedSafety(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-amber-600 border-amber-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="text-[12px] font-medium text-amber-950 leading-snug">
                    I confirm and authorize synchronization with these safety protection rules.
                  </span>
                </label>
              </div>
            )}

            {importError && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{importError}</span>
              </div>
            )}

            {parseResult.totalRows > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2.5">
                  Preview — {parseResult.columns.length} columns · {parseResult.rows.length} rows
                  {parseResult.columns.length > 6 && <span className="text-stone-400 normal-case"> (showing first 6 columns)</span>}
                </p>
                <PreviewTable
                  parseResult={parseResult}
                  qrColumn={qrColumn}
                  showAll={showAllRows}
                  onToggleAll={() => setShowAllRows((v) => !v)}
                />
              </div>
            )}

            {parseResult.invalidCount > 0 && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                <p className="text-[12px] font-semibold text-red-800 mb-2">{parseResult.invalidCount} row(s) will be skipped:</p>
                <ul className="space-y-1">
                  {parseResult.rows.filter((r) => r.state === 'invalid').slice(0, 8).map((r) => (
                    <li key={r.rowIndex} className="text-[11px] text-red-700">{r.errors[0]}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === STEP.IMPORTING && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 py-20 text-center px-6">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <p className="text-[14px] font-semibold text-stone-800">
              {hasExistingData ? 'Synchronizing Devotees with Firestore…' : 'Writing Registrations to Firestore…'}
            </p>
            <p className="text-[12px] text-stone-500 max-w-sm">
              Processing {parseResult?.validCount ?? 0} records safely while preserving verified devotee status.
            </p>
          </div>
        )}

        {step === STEP.DONE && importResult && (
          <ImportResult
            result={importResult}
            hasExistingData={hasExistingData}
            onClose={onClose}
          />
        )}
      </div>

      {/* Sticky footer — preview step only */}
      {step === STEP.PREVIEW && parseResult && parseResult.validCount > 0 && (
        <div className="shrink-0 px-5 py-4 bg-white border-t border-stone-200/70 shadow-lg">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[12px] text-stone-500 text-center sm:text-left">
              <span className="font-semibold text-stone-800">{parseResult.validCount}</span> valid records ready.
              {hasExistingData && !confirmedSafety && (
                <span className="text-amber-800 font-medium block sm:inline"> (Please check the confirmation box above to proceed)</span>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={hasExistingData && !confirmedSafety}
              className={`inline-flex items-center gap-2 px-6 h-12 rounded-2xl text-[14px] font-semibold transition-all cursor-pointer shadow-md
                ${hasExistingData && !confirmedSafety
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed shadow-none'
                  : hasExistingData
                    ? 'bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white shadow-amber-900/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-emerald-900/20'
                }`}
            >
              {hasExistingData ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync &amp; Update Registrations
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Import Registrations
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
