import { animalLabel } from "@/lib/labels";
import type { Animal, Contact, FarmDatabase } from "@/lib/types";
import type { QuickEntryProps } from "@/components/QuickEntry";
import type { ContactOption } from "@/components/ContactSelect";
import {
  mergeVaccineSchedules,
  type VaccineScheduleEntry,
} from "@/lib/livestock/vaccine-schedule";
import { extraDewormerNamesFromEvents, mergeDewormerNames } from "@/lib/livestock/medical-notes";
import { customerOwnedAnimals } from "@/lib/livestock/acquire-from-customer";
import { mergeExpenseCategories } from "@/lib/transactions/expense-categories";

function contactOptions(contacts: Contact[]) {
  const vendors: ContactOption[] = contacts
    .filter((c) => c.type === "Vendor")
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const customers: ContactOption[] = contacts
    .filter((c) => c.type === "Customer")
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const ownerOptions: ContactOption[] = [
    ...contacts
      .filter((c) => c.type === "Farm" || c.type === "Customer")
      .map((c) => ({ id: c.id, name: c.name })),
  ].sort((a, b) => {
    const rank = (n: string) => (n === "Farm" ? 0 : 1);
    const d = rank(a.name) - rank(b.name);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  return { vendors, customers, ownerOptions };
}

function animalOptions(animals: Animal[]) {
  const active = animals.filter((a) => a.status === "Active");
  const animalsOpts = active.map((a) => ({ id: a.id, label: animalLabel(a) }));
  const femaleAnimals = active
    .filter((a) => a.sex === "Female")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));
  const damAnimals = animals
    .filter((a) => a.sex === "Female")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));
  const maleAnimals = active
    .filter((a) => a.sex === "Male")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));

  return {
    animals: animalsOpts,
    femaleAnimals: femaleAnimals.length > 0 ? femaleAnimals : animalsOpts,
    damAnimals,
    maleAnimals,
  };
}

/** Lighter QuickEntry props for the animal profile editor. */
export function quickEntryPropsForProfile(
  contacts: Contact[],
  animals: Animal[],
  pastBuckNames: string[],
  vaccineSchedules: VaccineScheduleEntry[]
): Pick<
  QuickEntryProps,
  | "vendors"
  | "ownerOptions"
  | "damAnimals"
  | "femaleAnimals"
  | "maleAnimals"
  | "pastBuckNames"
  | "vaccineSchedules"
> {
  const { vendors, ownerOptions } = contactOptions(contacts);
  const { femaleAnimals, damAnimals, maleAnimals } = animalOptions(animals);
  return {
    vendors,
    ownerOptions,
    damAnimals,
    femaleAnimals,
    maleAnimals,
    pastBuckNames,
    vaccineSchedules,
  };
}

/** Build QuickEntry contact/animal props from the loaded database. */
export function quickEntryPropsFromDb(db: FarmDatabase): QuickEntryProps {
  const { animals, femaleAnimals, damAnimals, maleAnimals } = animalOptions(db.animals);
  const { vendors, customers, ownerOptions } = contactOptions(db.contacts);

  const pastBuckNames = [
    ...new Set(
      db.breeding_events
        .map((b) => b.buck_name)
        .filter((n): n is string => Boolean(n && n.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const customerOwned = customerOwnedAnimals(db);

  return {
    animals,
    customerOwnedAnimals: customerOwned,
    femaleAnimals: femaleAnimals.length > 0 ? femaleAnimals : animals,
    damAnimals,
    vendors,
    customers,
    ownerOptions,
    maleAnimals,
    pastBuckNames,
    vaccineSchedules: mergeVaccineSchedules(db.medical_events ?? []),
    dewormerNamesByType: {
      internal: mergeDewormerNames(
        extraDewormerNamesFromEvents(db.medical_events ?? [], "internal"),
        "internal"
      ),
      external: mergeDewormerNames(
        extraDewormerNamesFromEvents(db.medical_events ?? [], "external"),
        "external"
      ),
    },
    expenseCategories: mergeExpenseCategories((db.transactions ?? []).map((t) => t.category)),
  };
}
