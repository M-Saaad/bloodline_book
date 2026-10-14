import { normalizeLookupKey } from './normalize.mjs';

/**
 * @typedef {{ id: string, name: string | null, tag_number: string | null }} AnimalRef
 */

/**
 * @param {string | null | undefined} raw
 * @param {{
 *   byTag: Map<string, string>,
 *   byName: Map<string, string>,
 * }} lookup animal id by normalized tag/name
 * @returns {{ id: string | null, externalName: string | null, problem: string | null }}
 */
export function resolveParentReference(raw, lookup) {
  const text = raw == null ? '' : String(raw).trim();
  if (!text) {
    return { id: null, externalName: null, problem: null };
  }

  const key = normalizeLookupKey(text);
  const tagHit = lookup.byTag.get(key);
  const nameHit = lookup.byName.get(key);

  if (tagHit === '__ambiguous__' || nameHit === '__ambiguous__') {
    return {
      id: null,
      externalName: null,
      problem: `Ambiguous parent "${text}" (matches multiple animals)`,
    };
  }

  if (tagHit && nameHit && tagHit !== nameHit) {
    return {
      id: null,
      externalName: null,
      problem: `Ambiguous parent "${text}" (matches multiple animals)`,
    };
  }

  const id = tagHit ?? nameHit ?? null;
  if (id) {
    return { id, externalName: null, problem: null };
  }

  return { id: null, externalName: text, problem: null };
}

/**
 * @param {AnimalRef[]} animals
 */
export function buildAnimalLookup(animals) {
  const byTag = new Map();
  const byName = new Map();

  for (const animal of animals) {
    const tagKey = normalizeLookupKey(animal.tag_number);
    if (tagKey) {
      if (byTag.has(tagKey)) {
        byTag.set(tagKey, '__ambiguous__');
      } else {
        byTag.set(tagKey, animal.id);
      }
    }
    const nameKey = normalizeLookupKey(animal.name);
    if (nameKey) {
      if (byName.has(nameKey)) {
        byName.set(nameKey, '__ambiguous__');
      } else {
        byName.set(nameKey, animal.id);
      }
    }
  }

  return { byTag, byName };
}

export function lookupHasAmbiguity(lookup) {
  for (const id of lookup.byTag.values()) {
    if (id === '__ambiguous__') {
      return true;
    }
  }
  for (const id of lookup.byName.values()) {
    if (id === '__ambiguous__') {
      return true;
    }
  }
  return false;
}
