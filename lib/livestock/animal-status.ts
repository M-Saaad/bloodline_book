import type { Animal, BreedingEvent, Lactation, MedicalEvent } from "../types";
import type { StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { isKidAnimal } from "./age";
import { isBreedingInPipeline } from "./breeding";
import { todayIso } from "../format";

export type AnimalListBadge = {
  label: string;
  variant: StatusBadgeVariant;
};

export type AnimalBadgeContext = {
  withdrawalIds: Set<number>;
  inMilkIds: Set<number>;
  bredIds: Set<number>;
};

/** Precompute badge lookups once per page render instead of per animal row. */
export function buildAnimalBadgeContext(
  lactations: Lactation[],
  breeding: BreedingEvent[],
  medical: MedicalEvent[],
  today = todayIso()
): AnimalBadgeContext {
  const withdrawalIds = new Set<number>();
  for (const m of medical) {
    if (m.withdrawal_clear_date && m.withdrawal_clear_date >= today) {
      withdrawalIds.add(m.animal_id);
    }
  }

  const inMilkIds = new Set<number>();
  for (const l of lactations) {
    if (!l.dry_off_date && l.freshening_date <= today) {
      inMilkIds.add(l.animal_id);
    }
  }

  const bredIds = new Set<number>();
  for (const b of breeding) {
    if (isBreedingInPipeline(b)) bredIds.add(b.female_animal_id);
  }

  return { withdrawalIds, inMilkIds, bredIds };
}

export function animalListBadge(
  animal: Animal,
  lactations: Lactation[],
  breeding: BreedingEvent[],
  medical: MedicalEvent[],
  today = todayIso()
): AnimalListBadge | null {
  const ctx = buildAnimalBadgeContext(lactations, breeding, medical, today);
  return animalListBadgeFromContext(animal, ctx, today);
}

export function animalListBadgeFromContext(
  animal: Animal,
  ctx: AnimalBadgeContext,
  today = todayIso()
): AnimalListBadge | null {
  if (animal.status !== "Active") {
    return { label: animal.status, variant: "neutral" };
  }
  if (ctx.withdrawalIds.has(animal.id)) {
    return { label: "Withdrawal", variant: "accent" };
  }
  if (ctx.inMilkIds.has(animal.id)) {
    return { label: "In milk", variant: "success" };
  }
  if (ctx.bredIds.has(animal.id)) {
    return { label: "Bred", variant: "warning" };
  }
  if (isKidAnimal(animal, today)) {
    return { label: "Kid", variant: "neutral" };
  }
  if (animal.farm_tag?.toLowerCase().includes("sale")) {
    return { label: "For sale", variant: "neutral" };
  }
  return null;
}
