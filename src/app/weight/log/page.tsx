import { redirect } from "next/navigation";
import { loadActiveAnimalOptions } from "@/lib/db/queries";
import { getWriteAccess } from "@/lib/auth/roles";
import { LogWeightForm } from "@/components/forms/LogWeightForm";

export const dynamic = "force-dynamic";

export default async function LogWeightPage() {
  const canWrite = await getWriteAccess();
  if (!canWrite) redirect("/");

  const animals = await loadActiveAnimalOptions();
  return (
    <main className="min-h-screen bg-[var(--card-bg)]">
      <LogWeightForm animals={animals} />
    </main>
  );
}
