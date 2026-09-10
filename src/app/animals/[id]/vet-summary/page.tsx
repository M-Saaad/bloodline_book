import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAnimalProfileData } from "@/lib/db/queries";
import { emptyDb } from "@/lib/db";
import { buildVetSummary } from "@/lib/livestock/vet-summary";
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { isSupabaseDb, getCachedDb } from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/admin";
import { mapLactation } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

async function lactationsForAnimal(animalId: number) {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    return db.lactations.filter((l) => l.animal_id === animalId);
  }
  const client = createServiceClient();
  const { data, error } = await client.from("lactations").select("*").eq("animal_id", animalId);
  if (error) return [];
  return (data ?? []).map((r) => mapLactation(r as Record<string, unknown>));
}

export default async function VetSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const animalId = Number(id);
  if (!Number.isFinite(animalId)) notFound();

  const profile = await loadAnimalProfileData(animalId);
  if (!profile) notFound();

  const lactations = await lactationsForAnimal(animalId);
  const db = {
    ...emptyDb(),
    animals: profile.animals,
    medical_events: profile.medical_events,
    breeding_events: profile.breeding_events,
    lactations,
  };

  const summary = buildVetSummary(db, animalId);
  if (!summary) notFound();

  return (
    <main className="mx-auto max-w-lg bg-white px-6 py-8 text-stone-900 print:max-w-none print:px-8">
      <header className="border-b border-stone-300 pb-4 print:border-black">
        <p className="text-xs uppercase tracking-widest text-stone-500">Bloodline Book — Vet-ready summary</p>
        <h1 className="mt-1 text-2xl font-bold">{summary.animalLabel}</h1>
        <p className="text-sm text-stone-600">Generated {formatDate(summary.generatedOn)}</p>
      </header>

      {summary.identity.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wide">Identity</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {summary.identity.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {summary.sections.map((section) => (
        <section key={section.title} className="mt-5">
          <h2 className="text-sm font-bold uppercase tracking-wide">{section.title}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {section.lines.map((line, i) => (
              <li key={`${section.title}-${i}`}>{line}</li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="mt-8 border-t border-stone-200 pt-4 text-xs text-stone-500 print:border-black">
        This summary is for veterinary reference only. Bloodline Book does not diagnose, recommend treatments, or establish a VCPR. Call your veterinarian for medical decisions.
      </footer>

      <p className="mt-6 flex flex-wrap items-center gap-4 print:hidden">
        <Link href={`/animals/${animalId}`} className="text-sm font-semibold text-emerald-800">
          ← Back to animal
        </Link>
        <PrintButton />
      </p>
    </main>
  );
}
