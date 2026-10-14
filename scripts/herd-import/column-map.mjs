/**
 * Spreadsheet column → field mapping for herd import.
 */

export const HERD_IMPORT_FIELDS = [
  'name',
  'tag',
  'sex',
  'dob',
  'breed',
  'breed_percent',
  'dam',
  'sire',
  'reg_number',
  'reg_body',
  'tattoo',
  'notes',
];

const FIELD_PATTERNS = {
  name: [
    /^name$/i,
    /goat\s*name/i,
    /^animal$/i,
    /barn\s*name/i,
  ],
  tag: [
    /^tag$/i,
    /ear\s*tag/i,
    /^id$/i,
    /tag\s*#?/i,
  ],
  sex: [/^sex$/i, /^gender$/i, /^m\s*\/\s*f$/i],
  dob: [
    /^dob$/i,
    /birth\s*date/i,
    /date\s*of\s*birth/i,
    /^born$/i,
    /birthday/i,
  ],
  breed: [/^breed$/i],
  breed_percent: [/%/, /percent/i, /breed\s*%/i],
  dam: [/^dam$/i, /^mother$/i, /dam\s*name/i],
  sire: [/^sire$/i, /^father$/i, /sire\s*name/i, /^buck$/i],
  reg_number: [
    /reg(istration)?\s*#?/i,
    /^reg\s*no/i,
    /registry\s*#/i,
  ],
  reg_body: [/reg(istry)?\s*body/i, /^registry$/i, /^assoc/i],
  tattoo: [/^tattoo$/i],
  notes: [/^notes?$/i, /^comments?$/i, /^remarks?$/i],
};

function normalizeHeader(header) {
  return String(header ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * @param {string[]} headers
 * @returns {Record<string, string>}
 */
export function guessColumnMapping(headers) {
  const mapping = {};
  const used = new Set();

  for (const field of HERD_IMPORT_FIELDS) {
    const patterns = FIELD_PATTERNS[field] ?? [];
    let best = null;
    let bestScore = 0;
    for (const header of headers) {
      const norm = normalizeHeader(header);
      if (!norm || used.has(norm)) {
        continue;
      }
      for (const pattern of patterns) {
        if (pattern.test(norm)) {
          const score = pattern.source.length + (norm.length === field.length ? 10 : 0);
          if (score > bestScore) {
            bestScore = score;
            best = norm;
          }
        }
      }
    }
    if (best) {
      mapping[field] = best;
      used.add(best);
    }
  }

  return mapping;
}

/**
 * @param {Record<string, string>} base
 * @param {Record<string, string>} overrides from JSON (field→header or header→field)
 */
export function mergeColumnMapping(base, overrides) {
  const merged = { ...base };
  if (!overrides || typeof overrides !== 'object') {
    return merged;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!value || typeof value !== 'string') {
      continue;
    }
    const keyIsField = HERD_IMPORT_FIELDS.includes(key);
    const valueIsField = HERD_IMPORT_FIELDS.includes(value);
    if (keyIsField && !valueIsField) {
      merged[key] = value.trim();
    } else if (!keyIsField && valueIsField) {
      merged[value] = key.trim();
    } else if (keyIsField && valueIsField) {
      merged[key] = value.trim();
    }
  }
  return merged;
}

/**
 * @param {Record<string, string>} mapping field → header
 * @param {Record<string, unknown>} row keyed by header
 */
export function pickMappedRow(mapping, row) {
  const out = {};
  for (const field of HERD_IMPORT_FIELDS) {
    const header = mapping[field];
    if (!header) {
      out[field] = null;
      continue;
    }
    out[field] = row[header] ?? null;
  }
  return out;
}

export function formatMappingForPrint(mapping) {
  const lines = [];
  for (const field of HERD_IMPORT_FIELDS) {
    const header = mapping[field];
    lines.push(`  ${field}: ${header ?? '(not mapped)'}`);
  }
  return lines.join('\n');
}
