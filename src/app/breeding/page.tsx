import Link from "next/link";
import { Plus } from "lucide-react";
import { loadHerdHealthData } from "@/lib/db/queries";
import { isSupabaseDb } from "@/lib/db";
import { BottomNav } from "@/components/BottomNav";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { getWriteAccess } from "@/lib/auth/roles";
import { HealthBreedingList } from "@/components/HealthBreedingList";

export const dynamic = "force-dynamic";

export default async function BreedingPage() {
  const [canWrite, data] = await Promise.all([getWriteAccess(), loadHerdHealthData()]);

  return (
    <main className="relative flex min-h-screen flex-col pb-24">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="text-lg font-semibold text-[var(--text-primary)]">Breeding</p>
        {canWrite && (
          <Link href="/breeding/record" className="text-sm font-semibold text-[var(--accent-text)]">
            Record
          </Link>
        )}
      </div>

      {!canWrite && (
        <div className="px-4">
          <ViewOnlyBanner />
        </div>
      )}

      <div className="flex-1 px-4">
        {data.herd.breeding.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
            No breeding records yet
          </p>
        ) : (
          <HealthBreedingList rows={data.herd.breeding} supabaseEnabled={isSupabaseDb()} canWrite={canWrite} />
        )}
      </div>

      {canWrite && (
        <Link
          href="/breeding/record"
          className="absolute bottom-[90px] right-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--text-primary)] text-white shadow-lg"
          aria-label="Record breeding"
        >
          <Plus className="h-6 w-6" strokeWidth={1.8} />
        </Link>
      )}

      <BottomNav active="breeding" />
    </main>
  );
}
