import { redirect } from "next/navigation";
import { getQuickEntryData } from "@/lib/db/queries";
import { getWriteAccess } from "@/lib/auth/roles";
import { LogWeightForm } from "@/components/forms/LogWeightForm";

export const dynamic = "force-dynamic";

export default async function LogWeightPage() {
  const canWrite = await getWriteAccess();
  if (!canWrite) redirect("/");

  const data = await getQuickEntryData();
  return (
    <main className="min-h-screen bg-[var(--card-bg)]">
      <LogWeightForm animals={data.animals} />
    </main>
  );
}
