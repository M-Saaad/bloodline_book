import type { Animal, BreedingEvent, Lactation, MedicalEvent } from "../types";
import { isKidAnimal } from "./age";
import { isBreedingInPipeline } from "./breeding";
import { todayIso } from "../format";

export type HerdMetrics = {
  totalActive: number;
  inMilk: number;
  dueSoon: number;
};

export function isAnimalInMilk(animalId: number, lactations: Lactation[], today = todayIso()): boolean {
  return lactations.some(
    (l) =>
      l.animal_id === animalId &&
      !l.dry_off_date &&
      l.freshening_date <= today
  );
}

export function hasActiveWithdrawal(
  animalId: number,
  medical: MedicalEvent[],
  today = todayIso()
): boolean {
  return medical.some(
    (m) =>
      m.animal_id === animalId &&
      m.withdrawal_clear_date &&
      m.withdrawal_clear_date >= today
  );
}

export function computeHerdMetrics(
  animals: Animal[],
  lactations: Lactation[],
  breeding: BreedingEvent[],
  medical: MedicalEvent[],
  today = todayIso()
): HerdMetrics {
  const active = animals.filter((a) => a.status === "Active");
  const inMilk = active.filter((a) => isAnimalInMilk(a.id, lactations, today)).length;

  const dueSoonAnimalIds = new Set<number>();
  for (const b of breeding) {
    if (!isBreedingInPipeline(b)) continue;
    const due = b.due_date_early ?? b.expected_due_date;
    if (!due) continue;
    const days = Math.round(
      (new Date(due.slice(0, 10)).getTime() - new Date(today.slice(0, 10)).getTime()) / 86_400_000
    );
    if (days <= 14) dueSoonAnimalIds.add(b.female_animal_id);
  }

  return {
    totalActive: active.length,
    inMilk,
    dueSoon: dueSoonAnimalIds.size,
  };
}

export function filterAnimalsBySex(animals: Animal[], filter: string, today = todayIso()): Animal[] {
  if (filter === "does") return animals.filter((a) => a.sex === "Female" && !isKidAnimal(a, today));
  if (filter === "bucks") return animals.filter((a) => a.sex === "Male" && !isKidAnimal(a, today));
  if (filter === "kids") return animals.filter((a) => isKidAnimal(a, today));
  return animals;
}

export function searchAnimals(animals: Animal[], q: string): Animal[] {
  const needle = q.toLowerCase().trim();
  if (!needle) return animals;
  return animals.filter((a) => {
    const fields = [
      a.barn_name,
      a.registered_name,
      a.name,
      a.tattoo_right,
      a.tattoo_left,
      a.adga_registration_number,
      a.description,
      String(a.id),
    ];
    return fields.some((f) => f && f.toLowerCase().includes(needle));
  });
}
