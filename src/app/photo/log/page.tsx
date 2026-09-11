import { redirect } from "next/navigation";
import { loadActiveAnimalOptions } from "@/lib/db/queries";
import { getWriteAccess } from "@/lib/auth/roles";
import { LogPhotoForm } from "@/components/forms/LogPhotoForm";

export const dynamic = "force-dynamic";

export default async function LogPhotoPage() {
  const canWrite = await getWriteAccess();
  if (!canWrite) redirect("/");

  const animals = await loadActiveAnimalOptions();
  return (
    <main className="min-h-screen bg-[var(--card-bg)]">
      <LogPhotoForm animals={animals} />
    </main>
  );
}
