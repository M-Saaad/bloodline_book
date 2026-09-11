import type { Animal, BreedingEvent, FarmDatabase, MedicalEvent } from "../types";
import { todayIso } from "../format";
import { animalLabel } from "../labels";
import { isBreedingInPipeline } from "./breeding";

export type VetSummarySection = {
  title: string;
  lines: string[];
};

export type VetSummary = {
  generatedOn: string;
  animalLabel: string;
  identity: string[];
  sections: VetSummarySection[];
};

function activeWithdrawals(events: MedicalEvent[], today: string): string[] {
  return events
    .filter(
      (e) =>
        e.withdrawal_clear_date &&
        e.withdrawal_clear_date >= today &&
        (e.withdrawal_meat_days || e.withdrawal_milk_days)
    )
    .map((e) => {
      const parts: string[] = [];
      if (e.withdrawal_meat_days) parts.push(`meat ${e.withdrawal_meat_days}d`);
      if (e.withdrawal_milk_days) parts.push(`milk ${e.withdrawal_milk_days}d`);
      return `${e.date}: ${e.event_type} — clear ${e.withdrawal_clear_date} (${parts.join(", ")})`;
    });
}

function identityLines(animal: Animal): string[] {
  const lines: string[] = [];
  if (animal.registered_name) lines.push(`Registered: ${animal.registered_name}`);
  if (animal.barn_name) lines.push(`Barn name: ${animal.barn_name}`);
  if (animal.adga_registration_number) lines.push(`ADGA #: ${animal.adga_registration_number}`);
  if (animal.tattoo_right || animal.tattoo_left) {
    lines.push(`Tattoo: R ${animal.tattoo_right ?? "—"} / L ${animal.tattoo_left ?? "—"}`);
  }
  if (animal.tattoo_tail_web) lines.push(`Tail web tattoo: ${animal.tattoo_tail_web}`);
  if (animal.scrapie_tag) lines.push(`Scrapie tag: ${animal.scrapie_tag}`);
  if (animal.eid_microchip) lines.push(`EID/microchip: ${animal.eid_microchip}`);
  if (animal.farm_tag) lines.push(`Farm tag: ${animal.farm_tag}`);
  if (animal.breed) lines.push(`Breed: ${animal.breed}`);
  if (animal.sex) lines.push(`Sex: ${animal.sex}`);
  return lines;
}

function pregnancyLine(events: BreedingEvent[]): string | null {
  const active = events.find((e) => isBreedingInPipeline(e));
  if (!active) return null;
  if (active.due_date_early && active.due_date_late) {
    return `Pregnant — due window ${active.due_date_early} to ${active.due_date_late}`;
  }
  return active.expected_due_date ? `Pregnant — due ~${active.expected_due_date}` : "Pregnant — due date TBD";
}

export function buildVetSummary(db: FarmDatabase, animalId: number, today = todayIso()): VetSummary | null {
  const animal = db.animals.find((a) => a.id === animalId);
  if (!animal) return null;

  const medical = db.medical_events
    .filter((e) => e.animal_id === animalId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const breeding = db.breeding_events.filter((e) => e.female_animal_id === animalId);
  const lactation = db.lactations
    .filter((l) => l.animal_id === animalId && !l.dry_off_date)
    .sort((a, b) => b.freshening_date.localeCompare(a.freshening_date))[0];

  const sections: VetSummarySection[] = [];

  const withdrawals = activeWithdrawals(medical, today);
  sections.push({
    title: "Active withdrawal periods",
    lines: withdrawals.length ? withdrawals : ["None currently in effect"],
  });

  const vaccines = medical
    .filter((e) => e.event_type === "Vaccine")
    .slice(0, 8)
    .map((e) => `${e.date}: ${e.product_brand || e.notes || "Vaccine"}`);
  sections.push({
    title: "Recent vaccines",
    lines: vaccines.length ? vaccines : ["No vaccine records"],
  });

  const famacha = medical
    .filter((e) => e.event_type === "FAMACHA" || e.famacha_score != null)
    .slice(0, 6)
    .map((e) => `${e.date}: FAMACHA ${e.famacha_score ?? "—"}${e.body_condition_score ? `, BCS ${e.body_condition_score}` : ""}`);
  sections.push({
    title: "FAMACHA / BCS",
    lines: famacha.length ? famacha : ["No FAMACHA records"],
  });

  const treatments = medical
    .filter((e) => ["Deworming", "Surgery", "General"].includes(e.event_type))
    .slice(0, 8)
    .map((e) => {
      const dose =
        e.dose_amount != null
          ? ` — ${e.dose_amount}${e.dose_unit ? ` ${e.dose_unit}` : ""}`
          : "";
      return `${e.date}: ${e.event_type}${e.product_brand ? ` (${e.product_brand})` : ""}${dose}`;
    });
  sections.push({
    title: "Recent treatments",
    lines: treatments.length ? treatments : ["No treatment records"],
  });

  const statusLines: string[] = [];
  const pregnancy = pregnancyLine(breeding);
  if (pregnancy) statusLines.push(pregnancy);
  if (lactation) {
    statusLines.push(`In lactation since ${lactation.freshening_date} (#${lactation.lactation_number})`);
  } else if (animal.sex === "Female") {
    statusLines.push("Dry / not in active lactation record");
  }
  sections.push({
    title: "Reproduction / lactation",
    lines: statusLines.length ? statusLines : ["No active pregnancy or lactation"],
  });

  return {
    generatedOn: today,
    animalLabel: animalLabel(animal),
    identity: identityLines(animal),
    sections,
  };
}
