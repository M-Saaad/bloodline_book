import { redirect } from "next/navigation";
import { getQuickEntryData } from "@/lib/db/queries";
import { getWriteAccess } from "@/lib/auth/roles";
import { LogHealthForm } from "@/components/forms/LogHealthForm";

export const dynamic = "force-dynamic";

export default async function LogHealthPage() {
  const canWrite = await getWriteAccess();
  if (!canWrite) redirect("/");

  const data = await getQuickEntryData();
  return (
    <main className="min-h-screen bg-[var(--card-bg)]">
      <LogHealthForm
        animals={data.animals}
        vaccineSchedules={data.vaccineSchedules}
        dewormerNamesByType={data.dewormerNamesByType}
      />
    </main>
  );
}
