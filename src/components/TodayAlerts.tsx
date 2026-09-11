import { Syringe, Calendar, Droplet } from "lucide-react";
import { AlertCard } from "@/components/ui/AlertCard";
import { animalLinkFromHealth, healthTabForActionKind } from "@/lib/livestock/health-nav";
import type { HerdHealthData } from "@/lib/livestock/herd-health";

function actionSeverity(
  kind: HerdHealthData["actions"][number]["kind"],
  urgency: "overdue" | "due_soon"
): "danger" | "warning" | "accent" {
  if (kind === "withdrawal") return "accent";
  return urgency === "overdue" ? "danger" : "warning";
}

function actionIcon(kind: HerdHealthData["actions"][number]["kind"]) {
  if (kind === "breeding") return Calendar;
  if (kind === "withdrawal") return Droplet;
  return Syringe;
}

function actionHeadline(
  action: HerdHealthData["actions"][number]
): string {
  const prefix = action.urgency === "overdue" ? "Overdue: " : "";
  if (action.kind === "breeding") {
    return action.urgency === "overdue"
      ? "Kidding overdue"
      : `Kidding expected${action.detail.match(/\d+ day/) ? ` in ${action.detail.match(/\d+ day/)?.[0]}` : ""}`;
  }
  if (action.kind === "withdrawal") return "Milk withdrawal active";
  if (action.kind === "vaccine") return `${prefix}Vaccine due`;
  if (action.kind === "deworm") return `${prefix}Dewormer due`;
  if (action.kind === "famacha") return `${prefix}FAMACHA check due`;
  return action.label;
}

export function TodayAlerts({ actions }: { actions: HerdHealthData["actions"] }) {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">Nothing needs attention today</p>
    );
  }

  return (
    <>
      {actions.slice(0, 8).map((a, i) => (
        <AlertCard
          key={`${a.kind}-${a.animalId}-${i}`}
          href={animalLinkFromHealth(a.animalId, healthTabForActionKind(a.kind))}
          icon={actionIcon(a.kind)}
          severity={actionSeverity(a.kind, a.urgency)}
          headline={actionHeadline(a)}
          subline={
            a.kind === "withdrawal" && a.detail.includes("clears")
              ? a.detail
              : `${a.label} — ${a.detail}`
          }
        />
      ))}
    </>
  );
}
