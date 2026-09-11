import { redirect } from "next/navigation";
import { loadHomeData } from "@/lib/db/queries";
import { getWriteAccess } from "@/lib/auth/roles";
import { isAnimalInMilk } from "@/lib/livestock/herd-metrics";
import { displayBarnName, animalInitials } from "@/lib/labels";
import { todayIso } from "@/lib/format";
import { LogMilkForm } from "@/components/forms/LogMilkForm";

export const dynamic = "force-dynamic";

export default async function LogMilkPage() {
  const canWrite = await getWriteAccess();
  if (!canWrite) redirect("/");

  const home = await loadHomeData();
  const today = todayIso();
  const inMilkDoes = home.animals
    .filter((a) => a.sex === "Female" && a.status === "Active" && isAnimalInMilk(a.id, home.lactations, today))
    .map((a) => ({
      id: a.id,
      barnName: displayBarnName(a),
      initials: animalInitials(a),
    }));

  return (
    <main className="min-h-screen bg-[var(--card-bg)]">
      <LogMilkForm does={inMilkDoes} />
    </main>
  );
}
