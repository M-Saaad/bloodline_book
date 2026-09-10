import type { FarmDatabase } from "./types";
import { DEFAULT_FARM_SETTINGS } from "./livestock/breeding";

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
    milk_records: [],
    lactations: [],
    vet_contacts: [],
    farm_settings: { ...DEFAULT_FARM_SETTINGS },
    meta: {
      importedAt: null,
    },
  };
}
