import type { Animal } from "./types";

/** Display label for an animal row (shared by server loaders and actions). */
export function animalLabel(a: { name: string | null; description: string | null; id: number }) {
  return a.name || a.description?.slice(0, 40) || `Goat #${a.id}`;
}

export function displayBarnName(a: Animal): string {
  return a.barn_name || a.name || `Goat #${a.id}`;
}

export function displayRegisteredName(a: Animal): string | null {
  return a.registered_name || a.description || null;
}

export function animalInitials(a: Animal): string {
  const source = a.barn_name || a.name || a.tattoo_right || a.tattoo_left || String(a.id);
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function displayTattoo(a: Animal): string {
  if (a.breed === "LaMancha" && a.tattoo_tail_web) {
    return `Tail web: ${a.tattoo_tail_web}`;
  }
  const right = a.tattoo_right ?? "—";
  const left = a.tattoo_left ?? "—";
  return `${right} / ${left}`;
}
