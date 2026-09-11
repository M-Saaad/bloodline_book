import type { Animal, BreedingEvent, Lactation, MedicalEvent } from "../types";
import type { StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { isKidAnimal } from "./age";
import { isBreedingInPipeline } from "./breeding";
import { hasActiveWithdrawal, isAnimalInMilk } from "./herd-metrics";
import { todayIso } from "../format";

export type AnimalListBadge = {
  label: string;
  variant: StatusBadgeVariant;
};

export function animalListBadge(
  animal: Animal,
  lactations: Lactation[],
  breeding: BreedingEvent[],
  medical: MedicalEvent[],
  today = todayIso()
): AnimalListBadge | null {
  if (animal.status !== "Active") {
    return { label: animal.status, variant: "neutral" };
  }
  if (hasActiveWithdrawal(animal.id, medical, today)) {
    return { label: "Withdrawal", variant: "accent" };
  }
  if (isAnimalInMilk(animal.id, lactations, today)) {
    return { label: "In milk", variant: "success" };
  }
  const bred = breeding.some(
    (b) => b.female_animal_id === animal.id && isBreedingInPipeline(b)
  );
  if (bred) {
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
