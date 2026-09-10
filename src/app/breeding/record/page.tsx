import { redirect } from "next/navigation";
import { getQuickEntryData } from "@/lib/db/queries";
import { getWriteAccess } from "@/lib/auth/roles";
import { RecordBreedingForm } from "@/components/forms/RecordBreedingForm";

export const dynamic = "force-dynamic";

export default async function RecordBreedingPage() {
  const canWrite = await getWriteAccess();
  if (!canWrite) redirect("/");

  const data = await getQuickEntryData();
  const females = data.femaleAnimals ?? data.animals;

  return (
    <main className="min-h-screen bg-[var(--card-bg)]">
      <RecordBreedingForm
        femaleAnimals={females}
        maleAnimals={data.maleAnimals}
        pastBuckNames={data.pastBuckNames}
      />
    </main>
  );
}
