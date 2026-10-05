/**
 * excelService.js — Pure dynamic Excel parsing layer.
 *
 * ARCHITECTURE:
 *  - NO fixed column map. NO COLUMN_MAP. NO field name translation.
 *  - Whatever headers exist in the Excel become the keys in sourceData.
 *  - Values are preserved as accurately as possible from Excel.
 *  - Duplicate detection is based on the caller-supplied qrIdentifierColumn.
 *  - The only "validation" is: the qrIdentifierColumn must have a non-empty value.
 *
 * This file has zero Firestore imports and zero React imports.
 */

import * as XLSX from 'xlsx';

// ─── Value preservation ───────────────────────────────────────────────────────

/**
 * Safely convert an Excel cell value to a JS primitive.
 * - Strings: trimmed, empty string kept as empty string
 * - Numbers: kept as number
 * - Booleans: kept as boolean
 * - Excel date serials: converted to "YYYY-MM-DD" string
 * - null / undefined: returned as null (caller decides whether to include)
 */
function preserveValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    // Check if this looks like an Excel date serial (between 1 and ~50000)
    // We rely on the sheet being parsed with cellDates:false, so dates come as
    // numbers. We return them as-is; caller can choose to format if needed.
    return v;
  }
  if (typeof v === 'string') return v.trim();
  return String(v).trim();
}

/**
 * Convert a raw Excel row object into a clean sourceData object.
 * - Uses original column names as keys (no translation).
 * - Omits columns where the cell value is null/undefined/empty string
 *   so we never store empty fields that weren't in the Excel.
 *
 * @param {Record<string, unknown>} rawRow
 * @returns {Record<string, unknown>}
 */
function rowToSourceData(rawRow) {
  const sourceData = {};
  for (const [col, rawVal] of Object.entries(rawRow)) {
    const val = preserveValue(rawVal);
    // Only store the field if it has actual content
    if (val !== null && val !== '' && val !== undefined) {
      sourceData[col] = val;
    }
  }
  return sourceData;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ParseResult
 * @property {string}   fileName
 * @property {string}   sheetName
 * @property {number}   fileSizeKB
 * @property {number}   totalRows
 * @property {string[]} columns          - original column header names, in order
 * @property {import('../types/registration').ParsedRow[]} rows
 * — counts below are set AFTER classifyRows() is called (i.e. after QR column is known)
 * @property {number}   validCount
 * @property {number}   invalidCount
 * @property {number}   duplicateCount
 */

/**
 * Step 1 — Parse an Excel file and return raw column/row data.
 * Does NOT validate or classify rows yet (QR column not known at this point).
 * Pure function — no side effects, no Firestore.
 *
 * @param {File} file
 * @returns {Promise<ParseResult>}
 */
export async function parseExcelFile(file) {
  const buffer   = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('The Excel file contains no sheets.');

  const sheet = workbook.Sheets[sheetName];

  // header:1 gives us raw arrays; we use sheet_to_json with defval:null
  // so missing cells come as null (not empty string) — preserveValue handles null
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (rawRows.length === 0) {
    return {
      fileName:      file.name,
      sheetName,
      fileSizeKB:    Math.round(file.size / 1024),
      totalRows:     0,
      columns:       [],
      rows:          [],
      validCount:    0,
      invalidCount:  0,
      duplicateCount: 0,
    };
  }

  const columns = Object.keys(rawRows[0]);

  // Build rows with sourceData but no classification yet
  const rows = rawRows.map((rawRow, idx) => ({
    rowIndex:   idx + 2, // 1-based + skip header row
    state:      'valid', // placeholder — updated by classifyRows()
    errors:     [],
    sourceData: rowToSourceData(rawRow),
    rawData:    rawRow,
  }));

  return {
    fileName:      file.name,
    sheetName,
    fileSizeKB:    Math.round(file.size / 1024),
    totalRows:     rawRows.length,
    columns,
    rows,
    validCount:    rawRows.length, // all valid until classified
    invalidCount:  0,
    duplicateCount: 0,
  };
}

/**
 * Step 2 — Classify rows once the Super Admin has chosen the QR identifier column.
 * Mutates the rows in-place and updates the counts on the ParseResult.
 *
 * Rules:
 *  - A row is INVALID if the qrIdentifierColumn cell is missing or empty.
 *  - A row is DUPLICATE if its qrIdentifierColumn value has already appeared
 *    earlier in the file.
 *  - Otherwise VALID.
 *
 * @param {ParseResult} parseResult  — mutated in place
 * @param {string}      qrColumn    — the column name chosen as the QR identifier
 * @returns {ParseResult}            — same object, returned for convenience
 */
export function classifyRows(parseResult, qrColumn) {
  const seenIds = new Map(); // value → first rowIndex
  let validCount = 0, invalidCount = 0, duplicateCount = 0;

  for (const row of parseResult.rows) {
    const idValue = row.sourceData[qrColumn];

    if (idValue === null || idValue === undefined || idValue === '') {
      row.state  = 'invalid';
      row.errors = [`Row ${row.rowIndex}: "${qrColumn}" is empty — cannot be used as identifier.`];
      invalidCount++;
      continue;
    }

    const key = String(idValue).trim();

    if (seenIds.has(key)) {
      row.state  = 'duplicate';
      row.errors = [`Row ${row.rowIndex}: Duplicate identifier "${key}" (first seen at row ${seenIds.get(key)}).`];
      duplicateCount++;
      continue;
    }

    seenIds.set(key, row.rowIndex);
    row.state  = 'valid';
    row.errors = [];
    validCount++;
  }

  parseResult.validCount     = validCount;
  parseResult.invalidCount   = invalidCount;
  parseResult.duplicateCount = duplicateCount;

  return parseResult;
}
