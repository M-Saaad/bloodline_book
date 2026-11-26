import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import * as XLSX from 'xlsx';

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function rowsFromCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter((line) => line.trim() !== '');
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = parseCsvLine(nonEmpty[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < nonEmpty.length; i += 1) {
    const cells = parseCsvLine(nonEmpty[i]);
    if (cells.every((c) => c.trim() === '')) {
      continue;
    }
    const row = {};
    for (let c = 0; c < headers.length; c += 1) {
      const header = headers[c];
      if (!header) {
        continue;
      }
      row[header] = cells[c] ?? '';
    }
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Keep text cells as text so tags like "0007" keep their leading zeros.
 * If Excel stored a number but displays leading zeros ("0042"), keep that text.
 * Dates and plain numbers stay as Date / number so date parsing is unchanged.
 * @param {import('xlsx').WorkSheet} sheet
 * @param {number} r
 * @param {number} c
 */
function sheetCellValue(sheet, r, c) {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) {
    return '';
  }
  if (cell.t === 's' || cell.t === 'str') {
    return cell.v == null ? '' : String(cell.v);
  }
  if (cell.t === 'd' || cell.v instanceof Date) {
    return cell.v ?? '';
  }
  if (cell.t === 'n') {
    const shown = cell.w == null ? '' : String(cell.w).trim();
    // Excel number formats can display leading zeros ("0042") even though
    // the stored value is a number. Keep that text. Plain numbers and dates
    // do not look like this, so date parsing stays on the raw value.
    if (/^0\d+$/.test(shown)) {
      return shown;
    }
    return cell.v ?? '';
  }
  if (cell.t === 'b') {
    return cell.v ?? '';
  }
  return cell.w ?? cell.v ?? '';
}

/**
 * @param {import('xlsx').WorkSheet} sheet
 */
function rowsFromSheet(sheet) {
  const ref = sheet['!ref'];
  if (!ref) {
    return { headers: [], rows: [] };
  }
  const range = XLSX.utils.decode_range(ref);
  let headerRow = -1;
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    let any = false;
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      if (String(sheetCellValue(sheet, r, c) ?? '').trim() !== '') {
        any = true;
        break;
      }
    }
    if (any) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) {
    return { headers: [], rows: [] };
  }
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    headers.push(String(sheetCellValue(sheet, headerRow, c) ?? '').trim());
  }
  const rows = [];
  for (let r = headerRow + 1; r <= range.e.r; r += 1) {
    const line = [];
    let any = false;
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const value = sheetCellValue(sheet, r, c);
      line.push(value);
      if (String(value ?? '').trim() !== '') {
        any = true;
      }
    }
    if (!any) {
      continue;
    }
    const row = {};
    for (let c = 0; c < headers.length; c += 1) {
      const header = headers[c];
      if (!header) {
        continue;
      }
      row[header] = line[c] ?? '';
    }
    rows.push(row);
  }
  return { headers: headers.filter((header) => header !== ''), rows };
}

/**
 * @param {string} filePath
 * @param {{ sheet?: string }} [options]
 */
export async function readSpreadsheet(filePath, options = {}) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const text = await readFile(filePath, 'utf8');
    return rowsFromCsv(text);
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const buffer = await readFile(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName =
      options.sheet ??
      workbook.SheetNames[0];
    if (!sheetName || !workbook.Sheets[sheetName]) {
      const available = workbook.SheetNames.join(', ');
      throw new Error(
        `Sheet not found: ${options.sheet ?? '(first)'} (available: ${available})`,
      );
    }
    const sheet = workbook.Sheets[sheetName];
    return { ...rowsFromSheet(sheet), sheetName };
  }
  throw new Error(`Unsupported file type: ${ext} (use .csv or .xlsx)`);
}
