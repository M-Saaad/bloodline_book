import type { FarmDatabase } from "./types";

export function emptyDb(): FarmDatabase {
  return {
    contacts: [],
    animals: [],
    transactions: [],
    livestock_sales: [],
    purchase_agreements: [],
    medical_events: [],
    breeding_events: [],
    weight_logs: [],
    animal_media: [],
    meta: {
      importedAt: null,
    },
  };
}
