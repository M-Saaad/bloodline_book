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
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true,
    });
    const headerRow = matrix.find((row) =>
      row.some((cell) => String(cell ?? '').trim() !== ''),
    );
    if (!headerRow) {
      return { headers: [], rows: [], sheetName };
    }
    const headers = headerRow.map((h) => String(h ?? '').trim());
    const start = matrix.indexOf(headerRow);
    const rows = [];
    for (let i = start + 1; i < matrix.length; i += 1) {
      const line = matrix[i];
      if (!line || line.every((cell) => String(cell ?? '').trim() === '')) {
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
    return { headers, rows, sheetName };
  }
  throw new Error(`Unsupported file type: ${ext} (use .csv or .xlsx)`);
}
