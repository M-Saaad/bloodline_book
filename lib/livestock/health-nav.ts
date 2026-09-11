import type { HealthTab } from "./health-tabs";

export function animalLinkFromHealth(animalId: number, tab: HealthTab): string {
  if (tab === "overview") return `/animals/${animalId}?from=health`;
  return `/animals/${animalId}?from=health&tab=${tab}`;
}

export function backFromAnimalProfile(searchParams: {
  from?: string;
  tab?: string;
}): { href: string; label: string } {
  if (searchParams.from === "health") {
    const tab = searchParams.tab;
    const href = tab && tab !== "overview" ? `/health?tab=${tab}` : "/health";
    const labels: Record<string, string> = {
      overview: "Health",
      vaccine: "Vaccination",
      deworm: "Deworming",
      famacha: "FAMACHA",
      weight: "Weight",
    };
    return { href, label: labels[tab || "overview"] ?? "Health" };
  }
  return { href: "/animals", label: "Goats" };
}

export function healthTabForActionKind(
  kind: "vaccine" | "deworm" | "famacha" | "breeding" | "withdrawal"
): HealthTab {
  if (kind === "withdrawal" || kind === "breeding") return "overview";
  return kind;
}
