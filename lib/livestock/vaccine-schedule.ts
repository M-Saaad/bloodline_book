/** Disease-target-first vaccine schedule for US dairy goat breeders. */
export const VACCINE_INTERVAL_PRESETS = [
  { value: 365, label: "Once a year" },
  { value: 182, label: "Twice a year" },
  { value: 90, label: "Every 90 days" },
] as const;

export type DiseaseTargetKey =
  | "cdt"
  | "cl"
  | "rabies"
  | "pneumonia"
  | "soremouth"
  | "other";

export const BUILTIN_DISEASE_TARGETS: ReadonlyArray<{
  key: DiseaseTargetKey;
  label: string;
  defaultProduct: string;
  scheduleLabel: string;
  intervalDays: number;
}> = [
  {
    key: "cdt",
    label: "CD&T (Clostridium perfringens C&D + tetanus)",
    defaultProduct: "Bar-Vac CD/T",
    scheduleLabel: "once a year",
    intervalDays: 365,
  },
  {
    key: "cl",
    label: "Caseous lymphadenitis (CL)",
    defaultProduct: "Case-Bac",
    scheduleLabel: "once a year",
    intervalDays: 365,
  },
  {
    key: "rabies",
    label: "Rabies",
    defaultProduct: "Rabvac",
    scheduleLabel: "once a year",
    intervalDays: 365,
  },
  {
    key: "pneumonia",
    label: "Pneumonia / respiratory",
    defaultProduct: "Pneumobac",
    scheduleLabel: "once a year",
    intervalDays: 365,
  },
  {
    key: "soremouth",
    label: "Soremouth",
    defaultProduct: "Soremouth vaccine",
    scheduleLabel: "once a year",
    intervalDays: 365,
  },
  {
    key: "other",
    label: "Other (free text)",
    defaultProduct: "",
    scheduleLabel: "once a year",
    intervalDays: 365,
  },
];

/** @deprecated Use BUILTIN_DISEASE_TARGETS — kept for gradual UI migration */
export const BUILTIN_VACCINE_SCHEDULE = BUILTIN_DISEASE_TARGETS.map((t) => ({
  key: t.key,
  name: t.key === "other" ? "Other" : t.label.split(" (")[0],
  scheduleLabel: t.scheduleLabel,
  intervalDays: t.intervalDays,
}));

export type BuiltinVaccineKey = DiseaseTargetKey;
export type VaccineKind = DiseaseTargetKey | (string & {});

export type VaccineScheduleEntry = {
  key: string;
  /** Disease target label shown in schedules */
  name: string;
  /** Farm-specific product/brand under this target */
  productBrand: string;
  scheduleLabel: string;
  intervalDays: number;
};

export type VaccineNoteEvent = {
  event_type: string;
  notes: string | null;
  product_brand?: string | null;
};

export const NEW_VACCINE_VALUE = "__new__";

const DOSAGE_SUFFIX = /\s+\d+(?:\.\d+)?\s*(?:ml|cc|mL)\s*$/i;
const SCHEDULE_SUFFIX =
  /\s·\s(once a year|twice a year|every (\d+) days)\s*$/i;

export function scheduleLabelFromDays(days: number): string {
  if (days === 365) return "once a year";
  if (days === 182) return "twice a year";
  return `every ${days} days`;
}

export function isBuiltinVaccineKey(key: string): boolean {
  return BUILTIN_DISEASE_TARGETS.some((b) => b.key === key);
}

export function diseaseTargetByKey(key: string) {
  return BUILTIN_DISEASE_TARGETS.find((t) => t.key === key) ?? null;
}

export function vaccineKeyFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "vaccine";
}

export function builtinVaccineByName(name: string): VaccineScheduleEntry | null {
  const trimmed = name.trim();
  const byTarget = BUILTIN_DISEASE_TARGETS.find(
    (t) => t.label.toLowerCase() === trimmed.toLowerCase() || t.key === trimmed.toLowerCase()
  );
  if (byTarget) {
    return {
      key: byTarget.key,
      name: byTarget.label,
      productBrand: byTarget.defaultProduct,
      scheduleLabel: byTarget.scheduleLabel,
      intervalDays: byTarget.intervalDays,
    };
  }
  const legacy = BUILTIN_VACCINE_SCHEDULE.find((v) => v.name.toUpperCase() === trimmed.toUpperCase());
  if (!legacy) return null;
  const target = diseaseTargetByKey(legacy.key);
  return {
    key: legacy.key,
    name: target?.label ?? legacy.name,
    productBrand: target?.defaultProduct ?? legacy.name,
    scheduleLabel: legacy.scheduleLabel,
    intervalDays: legacy.intervalDays,
  };
}

function matchesBuiltinNotes(upper: string, key: DiseaseTargetKey): boolean {
  if (key === "cdt") return upper.includes("CD&T") || upper.includes("CDT") || upper.includes("CLOSTRIDIUM");
  if (key === "cl") return upper.includes("CL") || upper.includes("CASEOUS") || upper.includes("LYMPHADENITIS");
  if (key === "rabies") return upper.includes("RABIES");
  if (key === "pneumonia") return upper.includes("PNEUMO") || upper.includes("RESPIRATORY");
  if (key === "soremouth") return upper.includes("SOREMOUTH") || upper.includes("ORF");
  return false;
}

function intervalFromScheduleLabel(label: string, everyDays?: string): number | null {
  const lower = label.toLowerCase();
  if (lower === "once a year") return 365;
  if (lower === "twice a year") return 182;
  if (everyDays) {
    const days = Number.parseInt(everyDays, 10);
    if (Number.isFinite(days) && days > 0) return days;
  }
  return null;
}

export function parseVaccineNote(notes: string | null | undefined): {
  name: string;
  productBrand: string | null;
  dosage: string | null;
  intervalDays: number | null;
} | null {
  let text = (notes ?? "").trim();
  if (!text) return null;

  let intervalDays: number | null = null;
  const scheduleMatch = text.match(SCHEDULE_SUFFIX);
  if (scheduleMatch) {
    intervalDays = intervalFromScheduleLabel(scheduleMatch[1], scheduleMatch[2]);
    text = text.slice(0, scheduleMatch.index).trim();
  }

  const dosageMatch = text.match(DOSAGE_SUFFIX);
  const dosage = dosageMatch ? dosageMatch[0].trim() : null;
  const name = text.replace(DOSAGE_SUFFIX, "").trim() || text;
  if (!name) return null;

  const builtin = builtinVaccineByName(name);
  return {
    name: builtin?.name ?? name,
    productBrand: builtin?.productBrand ?? null,
    dosage,
    intervalDays,
  };
}

export type VaccineRecordMatch = {
  id: string;
  event_type: string;
  date: string | null;
  notes: string | null;
};

export function similarVaccineEvents<T extends VaccineRecordMatch>(
  events: T[],
  target: VaccineRecordMatch
): T[] {
  if (target.event_type !== "Vaccine") return [];
  const date = (target.date ?? "").slice(0, 10);
  const notes = target.notes ?? "";
  return events.filter(
    (event) =>
      event.id !== target.id &&
      event.event_type === "Vaccine" &&
      (event.date ?? "").slice(0, 10) === date &&
      (event.notes ?? "") === notes
  );
}

function extraVaccinesFromEvents(events: VaccineNoteEvent[]): VaccineScheduleEntry[] {
  const byKey = new Map<string, VaccineScheduleEntry>();
  for (const event of events) {
    if (event.event_type !== "Vaccine") continue;
    const parsed = parseVaccineNote(event.notes);
    if (!parsed) continue;
    if (builtinVaccineByName(parsed.name)) continue;
    const upper = parsed.name.toUpperCase();
    if (BUILTIN_DISEASE_TARGETS.some((b) => b.key !== "other" && matchesBuiltinNotes(upper, b.key))) {
      continue;
    }

    const key = vaccineKeyFromName(parsed.name);
    if (isBuiltinVaccineKey(key)) continue;
    const intervalDays = parsed.intervalDays ?? byKey.get(key)?.intervalDays ?? 365;
    byKey.set(key, {
      key,
      name: byKey.get(key)?.name ?? parsed.name,
      productBrand: event.product_brand ?? parsed.productBrand ?? parsed.name,
      scheduleLabel: scheduleLabelFromDays(intervalDays),
      intervalDays,
    });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeVaccineSchedules(events: VaccineNoteEvent[] = []): VaccineScheduleEntry[] {
  const builtins: VaccineScheduleEntry[] = BUILTIN_DISEASE_TARGETS.map((t) => ({
    key: t.key,
    name: t.label,
    productBrand: t.defaultProduct,
    scheduleLabel: t.scheduleLabel,
    intervalDays: t.intervalDays,
  }));
  return [...builtins, ...extraVaccinesFromEvents(events)];
}

export function vaccineKeyFromNotes(
  notes: string | null | undefined,
  schedules: VaccineScheduleEntry[]
): string | null {
  const text = (notes ?? "").trim();
  if (!text) return null;
  const upper = text.toUpperCase();

  for (const schedule of schedules) {
    if (
      isBuiltinVaccineKey(schedule.key) &&
      matchesBuiltinNotes(upper, schedule.key as DiseaseTargetKey)
    ) {
      return schedule.key;
    }
  }

  const sorted = [...schedules].sort((a, b) => b.name.length - a.name.length);
  for (const schedule of sorted) {
    const nameUpper = schedule.name.toUpperCase();
    if (upper.startsWith(`${nameUpper} `) || upper === nameUpper) return schedule.key;
    if (schedule.productBrand && upper.includes(schedule.productBrand.toUpperCase())) {
      return schedule.key;
    }
  }
  return null;
}

/** @deprecated Use vaccineKeyFromNotes with schedules */
export function vaccineKindFromNotes(notes: string | null | undefined): VaccineKind | null {
  return vaccineKeyFromNotes(notes, mergeVaccineSchedules([]));
}

export function vaccineDisplayName(
  key: string | null | undefined,
  schedules: VaccineScheduleEntry[]
): string {
  if (!key) return "Vaccine";
  const entry = schedules.find((s) => s.key === key);
  if (!entry) return "Vaccine";
  return entry.productBrand ? `${entry.name} (${entry.productBrand})` : entry.name;
}

export function parseVaccineIntervalDays(raw: string): number {
  const days = Number.parseInt(raw, 10);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("Select a vaccine schedule");
  }
  return days;
}
