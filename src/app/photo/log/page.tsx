import { redirect } from "next/navigation";
import { getQuickEntryData } from "@/lib/db/queries";
import { getWriteAccess } from "@/lib/auth/roles";
import { LogPhotoForm } from "@/components/forms/LogPhotoForm";

export const dynamic = "force-dynamic";

export default async function LogPhotoPage() {
  const canWrite = await getWriteAccess();
  if (!canWrite) redirect("/");

  const data = await getQuickEntryData();
  return (
    <main className="min-h-screen bg-[var(--card-bg)]">
      <LogPhotoForm animals={data.animals} />
    </main>
  );
}
