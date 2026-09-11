import { Suspense } from "react";
import Link from "next/link";
import { SlidersHorizontal, Plus } from "lucide-react";
import { loadAnimalsListData } from "@/lib/db/queries";
import { displayBarnName, displayRegisteredName, animalInitials } from "@/lib/labels";
import {
  searchAnimals,
  filterAnimalsBySex,
  isAnimalInMilk,
} from "@/lib/livestock/herd-metrics";
import { isBreedingInPipeline } from "@/lib/livestock/breeding";
import { animalListBadgeFromContext, buildAnimalBadgeContext } from "@/lib/livestock/animal-status";
import { todayIso } from "@/lib/format";
import { BottomNav } from "@/components/BottomNav";
import { AnimalsFilters } from "@/components/AnimalsFilters";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { getWriteAccess } from "@/lib/auth/roles";
import type { Animal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnimalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const canWrite = await getWriteAccess();
  const data = await loadAnimalsListData();
  const today = todayIso();
  const q = sp.q || "";
  const filter = sp.filter || "all";

  let animals = [...data.animals].filter((a) => a.status === "Active" || filter === "all");

  if (filter === "in-milk") {
    animals = animals.filter((a) => isAnimalInMilk(a.id, data.lactations, today));
  } else if (filter === "due-soon") {
    const dueIds = new Set(
      data.breeding_events
        .filter((b) => {
          if (!isBreedingInPipeline(b)) return false;
          const due = b.due_date_early ?? b.expected_due_date;
          if (!due) return false;
          const days = Math.round(
            (new Date(due.slice(0, 10)).getTime() - new Date(today.slice(0, 10)).getTime()) /
              86_400_000
          );
          return days <= 14;
        })
        .map((b) => b.female_animal_id)
    );
    animals = animals.filter((a) => dueIds.has(a.id));
  } else if (["does", "bucks", "kids"].includes(filter)) {
    animals = filterAnimalsBySex(animals, filter, today);
  }

  if (q) animals = searchAnimals(animals, q);

  animals.sort((a, b) => displayBarnName(a).localeCompare(displayBarnName(b)));

  const badgeContext = buildAnimalBadgeContext(
    data.lactations,
    data.breeding_events,
    data.medical_events,
    today
  );

  return (
    <main className="relative flex min-h-screen flex-col pb-24">
      <div className="flex items-center justify-between px-4 pb-2.5 pt-4">
        <p className="text-lg font-semibold text-[var(--text-primary)]">Animals</p>
        <button type="button" className="p-1 text-[var(--text-secondary)]" aria-label="Filter">
          <SlidersHorizontal className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>

      {!canWrite && (
        <div className="px-4">
          <ViewOnlyBanner />
        </div>
      )}

      <div className="px-4 pb-3">
        <Suspense fallback={<div className="h-20 animate-pulse rounded-[var(--radius)] bg-[var(--field-bg)]" />}>
          <AnimalsFilters />
        </Suspense>
      </div>

      <div className="flex-1 border-t border-[var(--border)]">
        {animals.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            No animals match your search
          </p>
        ) : (
          animals.map((a) => (
            <AnimalRow
              key={a.id}
              animal={a}
              badgeContext={badgeContext}
              today={today}
            />
          ))
        )}
      </div>

      {canWrite && (
        <Link
          href="/animals/new"
          className="absolute bottom-[90px] right-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--text-primary)] text-white shadow-lg"
          aria-label="Add animal"
        >
          <Plus className="h-6 w-6" strokeWidth={1.8} />
        </Link>
      )}

      <BottomNav active="animals" />
    </main>
  );
}

function AnimalRow({
  animal,
  badgeContext,
  today,
}: {
  animal: Animal;
  badgeContext: ReturnType<typeof buildAnimalBadgeContext>;
  today: string;
}) {
  const badge = animalListBadgeFromContext(animal, badgeContext, today);
  const reg = displayRegisteredName(animal);
  const breedLine = [reg, animal.breed].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/animals/${animal.id}`}
      className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-2.5 active:bg-[var(--field-bg)]"
    >
      <Avatar initials={animalInitials(animal)} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{displayBarnName(animal)}</p>
        <p className="text-xs text-[var(--text-secondary)]">{breedLine}</p>
      </div>
      {badge && <StatusBadge label={badge.label} variant={badge.variant} />}
    </Link>
  );
}
