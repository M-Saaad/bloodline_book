import { builtinVaccineByName, scheduleLabelFromDays } from "./vaccine-schedule";

export {
  BUILTIN_VACCINE_SCHEDULE,
  BUILTIN_DISEASE_TARGETS,
  mergeVaccineSchedules,
  vaccineDisplayName,
  vaccineKeyFromNotes,
  vaccineKindFromNotes,
  type VaccineKind,
  type VaccineScheduleEntry,
  type DiseaseTargetKey,
} from "./vaccine-schedule";

export const DEWORM_DRUG_CLASSES = [
  {
    key: "benzimidazoles",
    label: "Benzimidazoles",
    products: ["Safeguard / Panacur (fenbendazole)", "Valbazen (albendazole)"],
  },
  {
    key: "imidazothiazoles",
    label: "Imidazothiazoles",
    products: ["Prohibit / Levasole / Tramisol (levamisole)"],
  },
  {
    key: "macrocyclic_lactones",
    label: "Macrocyclic lactones",
    products: ["Ivomec (ivermectin)", "Cydectin (moxidectin)"],
  },
  {
    key: "tetrahydropyrimidines",
    label: "Tetrahydropyrimidines",
    products: ["Rumatel (morantel tartrate)"],
  },
] as const;

export type DewormDrugClass = (typeof DEWORM_DRUG_CLASSES)[number]["key"];

export const DEWORM_TYPES = [
  { value: "internal", label: "Internal", prefix: "I-DW" },
  { value: "external", label: "External", prefix: "E-DW" },
] as const;
export type DewormType = (typeof DEWORM_TYPES)[number]["value"];

/** External deworming is due this many days after the latest internal deworming. */
export const EXTERNAL_DEWORM_DELAY_DAYS = 2;

/** FAMACHA checks are recommended on a rolling interval — not a blind deworm calendar. */
export const FAMACHA_CHECK_INTERVAL_DAYS = 28;

export const MEDICAL_ROUTES = [
  "oral drench",
  "injectable",
  "topical",
  "feed",
  "intranasal",
] as const;

export const DOSE_UNITS = ["mL", "cc", "mg", "per-kg", "per-lb"] as const;

export const PRODUCTION_STAGES = [
  "dry",
  "early gestation",
  "late gestation",
  "pre-kidding",
  "fresh",
  "peak lactation",
  "mid lactation",
  "late lactation",
  "weaning",
  "show prep",
  "illness recovery",
] as const;

export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

/** US-standard dewormer products by drug class (internal = gastrointestinal). */
export const DEWORMER_NAMES_BY_TYPE: Record<DewormType, readonly string[]> = {
  internal: [
    "Safeguard / Panacur (fenbendazole)",
    "Valbazen (albendazole)",
    "Prohibit / Levasole / Tramisol (levamisole)",
    "Ivomec (ivermectin)",
    "Cydectin (moxidectin)",
    "Rumatel (morantel tartrate)",
  ],
  external: ["Ivomec (ivermectin)", "Cydectin (moxidectin)"],
};

export const DEWORMER_NAMES = [
  ...DEWORMER_NAMES_BY_TYPE.internal,
  ...DEWORMER_NAMES_BY_TYPE.external,
] as const;

const DOSAGE_SUFFIX = /\s+\d+(?:\.\d+)?\s*(?:ml|cc|mL|mg)\s*$/i;

export type DewormNoteEvent = {
  event_type: string;
  notes: string | null;
};

export function drugClassForProduct(name: string): DewormDrugClass | null {
  const upper = name.toUpperCase();
  for (const cls of DEWORM_DRUG_CLASSES) {
    if (cls.products.some((p) => upper.includes(p.split("(")[0].trim().toUpperCase()))) {
      return cls.key;
    }
  }
  if (upper.includes("FENBENDAZOLE") || upper.includes("PANACUR") || upper.includes("SAFEGUARD")) {
    return "benzimidazoles";
  }
  if (upper.includes("ALBENDAZOLE") || upper.includes("VALBAZEN")) return "benzimidazoles";
  if (upper.includes("LEVAMISOLE") || upper.includes("PROHIBIT") || upper.includes("TRAMISOL")) {
    return "imidazothiazoles";
  }
  if (upper.includes("IVERMECTIN") || upper.includes("IVOMEC") || upper.includes("CYDECTIN") || upper.includes("MOXIDECTIN")) {
    return "macrocyclic_lactones";
  }
  if (upper.includes("MORANTEL") || upper.includes("RUMATEL")) return "tetrahydropyrimidines";
  return null;
}

export function dewormKindFromNotes(notes: string | null | undefined): DewormType | null {
  const text = (notes ?? "").trim();
  if (text.startsWith("I-DW") || text.includes("I-DW")) return "internal";
  if (text.startsWith("E-DW") || text.includes("E-DW")) return "external";
  return null;
}

export function builtinDewormerByName(name: string, type: DewormType): string | null {
  const upper = name.trim().toUpperCase();
  const match = DEWORMER_NAMES_BY_TYPE[type].find((n) => n.toUpperCase() === upper);
  return match ?? null;
}

export function parseDewormNote(
  notes: string | null | undefined
): { type: DewormType; name: string; drugClass: DewormDrugClass | null } | null {
  const text = (notes ?? "").trim();
  const match = text.match(/^(I-DW|E-DW)\s+(.+)$/i);
  if (!match) return null;
  const type: DewormType = match[1].toUpperCase() === "I-DW" ? "internal" : "external";
  const name = match[2].replace(DOSAGE_SUFFIX, "").trim();
  if (!name) return null;
  return { type, name, drugClass: drugClassForProduct(name) };
}

export function extraDewormerNamesFromEvents(
  events: DewormNoteEvent[],
  type: DewormType
): string[] {
  const byLower = new Map<string, string>();
  for (const event of events) {
    if (event.event_type !== "Deworming") continue;
    const parsed = parseDewormNote(event.notes);
    if (!parsed || parsed.type !== type) continue;
    if (builtinDewormerByName(parsed.name, type)) continue;
    const key = parsed.name.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, parsed.name);
  }
  return [...byLower.values()];
}

export function mergeDewormerNames(extraNames: string[], type: DewormType): string[] {
  const builtins = [...DEWORMER_NAMES_BY_TYPE[type]];
  const builtinUpper = new Set(builtins.map((n) => n.toUpperCase()));
  const extras = extraNames
    .map((n) => n.trim())
    .filter((name) => name && !builtinUpper.has(name.toUpperCase()));
  const seen = new Set<string>(builtins.map((n) => n.toUpperCase()));
  const uniqueExtras: string[] = [];
  for (const name of extras) {
    const key = name.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueExtras.push(name);
  }
  return [...builtins, ...uniqueExtras];
}

export function computeWithdrawalClearDate(
  eventDate: string,
  meatDays: number | null | undefined,
  milkDays: number | null | undefined
): string | null {
  const days = Math.max(meatDays ?? 0, milkDays ?? 0);
  if (!eventDate || days <= 0) return null;
  const d = new Date(eventDate.slice(0, 10));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatVaccineNotes(input: {
  diseaseTarget: string;
  productBrand?: string;
  dosage: string;
  intervalDays?: number;
}): string {
  const target = input.diseaseTarget.trim();
  const brand = input.productBrand?.trim();
  const d = input.dosage.trim();
  if (!target) throw new Error("Select a disease target");
  if (!d) throw new Error("Enter vaccine dosage");
  const label = brand ? `${target} · ${brand}` : target;
  const base = `${label} ${d}`;
  if (input.intervalDays && !builtinVaccineByName(target)) {
    return `${base} · ${scheduleLabelFromDays(input.intervalDays)}`;
  }
  return base;
}

/** @deprecated Prefer formatVaccineNotes with diseaseTarget + productBrand */
export function formatVaccineNotesLegacy(name: string, dosage: string, intervalDays?: number): string {
  return formatVaccineNotes({ diseaseTarget: name, dosage, intervalDays });
}

export function formatDewormNotes(input: {
  type: string;
  name: string;
  dosage: string;
}): string {
  const kind = DEWORM_TYPES.find((t) => t.value === input.type);
  if (!kind) throw new Error("Select internal or external deworming");
  const name = input.name.trim();
  const dosage = input.dosage.trim();
  if (!name) throw new Error("Enter dewormer name");
  if (!dosage) throw new Error("Enter dewormer dosage");
  return `${kind.prefix} ${name} ${dosage}`;
}
