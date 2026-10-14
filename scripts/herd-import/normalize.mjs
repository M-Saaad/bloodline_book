/**
 * Pure parsing / normalization helpers for scripts/import-herd.mjs.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Excel 1900 date system epoch (1899-12-30 UTC). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

export function normalizeLookupKey(value) {
  if (value == null) {
    return '';
  }
  return String(value).trim().toLowerCase();
}

export function normalizeSex(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { sex: null, wetherNote: false, problem: 'Missing sex' };
  }
  const folded = String(raw).trim().toLowerCase().replace(/\./g, '');
  const wether =
    folded.includes('wether') ||
    folded === 'w' ||
    folded === 'weather' ||
    folded.includes('castrat');

  if (
    wether ||
    folded === 'buck' ||
    folded === 'b' ||
    folded === 'm' ||
    folded === 'male' ||
    folded === 'ram'
  ) {
    return { sex: 'male', wetherNote: wether, problem: null };
  }

  if (
    folded === 'doe' ||
    folded === 'd' ||
    folded === 'f' ||
    folded === 'female' ||
    folded === 'nanny' ||
    folded === 'ewe'
  ) {
    return { sex: 'female', wetherNote: false, problem: null };
  }

  return { sex: null, wetherNote: false, problem: `Unrecognized sex: ${raw}` };
}

/**
 * @param {unknown} raw
 * @param {string} [referenceIso] YYYY-MM-DD for age heuristics
 * @returns {{ iso: string | null, problem: string | null }}
 */
export function normalizeDateOfBirth(raw, referenceIso) {
  if (raw == null || String(raw).trim() === '') {
    return { iso: null, problem: null };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { iso: toIsoUtc(raw), problem: null };
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const fromSerial = excelSerialToIso(raw);
    if (fromSerial) {
      return { iso: fromSerial, problem: null };
    }
  }

  const text = String(raw).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    const fromSerial = excelSerialToIso(serial);
    if (fromSerial) {
      return { iso: fromSerial, problem: null };
    }
  }

  const isoLike = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (isoLike) {
    const iso = padIso(isoLike[1], isoLike[2], isoLike[3]);
    return iso
      ? { iso, problem: null }
      : { iso: null, problem: `Invalid date: ${text}` };
  }

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(text);
  if (us) {
    let year = Number(us[3]);
    if (year < 100) {
      year += year >= 30 ? 1900 : 2000;
    }
    const iso = padIso(String(year), us[1], us[2]);
    return iso
      ? { iso, problem: null }
      : { iso: null, problem: `Invalid date: ${text}` };
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return { iso: toIsoUtc(parsed), problem: null };
  }

  return { iso: null, problem: `Invalid date: ${text}` };
}

function padIso(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

function toIsoUtc(date) {
  return date.toISOString().slice(0, 10);
}

export function excelSerialToIso(serial) {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100000) {
    return null;
  }
  const wholeDays = Math.floor(serial);
  const ms = EXCEL_EPOCH_MS + wholeDays * MS_PER_DAY;
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  return toIsoUtc(dt);
}

export function parseBreedPercentage(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { value: null, problem: null };
  }
  const text = String(raw).trim().replace(/%/g, '');
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return { value: null, problem: `Invalid breed %: ${raw}` };
  }
  return { value: Math.round(num * 100) / 100, problem: null };
}

/**
 * @param {unknown} raw
 * @returns {{ body: 'adga' | 'abga' | 'usbga' | 'other' | null, problem: string | null }}
 */
export function parseRegistrationBody(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { body: null, problem: null };
  }
  const folded = String(raw).trim().toLowerCase();
  if (folded.includes('adga')) {
    return { body: 'adga', problem: null };
  }
  if (folded.includes('abga')) {
    return { body: 'abga', problem: null };
  }
  if (folded.includes('usbga')) {
    return { body: 'usbga', problem: null };
  }
  if (folded === 'other') {
    return { body: 'other', problem: null };
  }
  return { body: 'other', problem: null };
}

export function cleanText(raw) {
  if (raw == null) {
    return null;
  }
  const text = String(raw).trim();
  return text === '' ? null : text;
}

export function appendNote(existing, addition) {
  const base = existing?.trim() ?? '';
  const extra = addition?.trim() ?? '';
  if (!extra) {
    return base || null;
  }
  if (!base) {
    return extra;
  }
  if (base.toLowerCase().includes(extra.toLowerCase())) {
    return base;
  }
  return `${base}; ${extra}`;
}

/**
 * @param {string | null} dobIso
 * @param {'male' | 'female'} sex
 * @param {string} referenceIso
 */
export function inferLifecycleStage(dobIso, sex, referenceIso) {
  if (!dobIso) {
    return sex === 'male' ? 'adult' : 'breeding';
  }
  const ref = parseIso(referenceIso);
  const birth = parseIso(dobIso);
  if (!ref || !birth) {
    return sex === 'male' ? 'adult' : 'breeding';
  }
  const ageDays = Math.floor((ref - birth) / MS_PER_DAY);
  if (ageDays < 0) {
    return 'kid';
  }
  if (ageDays < 180) {
    return 'kid';
  }
  if (ageDays < 365) {
    return 'weaned';
  }
  if (ageDays < 730) {
    return 'yearling';
  }
  if (sex === 'male') {
    return 'adult';
  }
  return 'breeding';
}

function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) {
    return null;
  }
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * @param {string} breedName
 * @param {{ id: string, name: string, farm_id: string | null }[]} breeds
 * @returns {{ breedId: string | null, canonicalName: string, createFarmBreed: boolean }}
 */
export function resolveBreedName(breedName, breeds) {
  const cleaned = cleanText(breedName);
  if (!cleaned) {
    return { breedId: null, canonicalName: '', createFarmBreed: false };
  }
  const key = normalizeLookupKey(cleaned);
  const match = breeds.find((b) => normalizeLookupKey(b.name) === key);
  if (match) {
    return {
      breedId: match.id,
      canonicalName: match.name,
      createFarmBreed: false,
    };
  }
  return {
    breedId: null,
    canonicalName: titleCaseBreed(cleaned),
    createFarmBreed: true,
  };
}

function titleCaseBreed(name) {
  return name
    .split(/\s+/)
    .map((part) =>
      part.length <= 3 && /^[a-z]+$/i.test(part)
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(' ');
}

export function validateNameOrTag(name, tag) {
  const n = name?.trim() ?? '';
  const t = tag?.trim() ?? '';
  if (!n && !t) {
    return 'Need a name or tag number';
  }
  return null;
}
