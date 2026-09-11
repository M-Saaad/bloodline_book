import { Suspense } from "react";
import { loadHomeData, loadHerdHealthData } from "@/lib/db/queries";
import { computeHerdMetrics } from "@/lib/livestock/herd-metrics";
import { DEFAULT_FARM_SETTINGS } from "@/lib/livestock/breeding";
import { HomeHeader } from "@/components/HomeHeader";
import { TodayAlerts } from "@/components/TodayAlerts";
import { BottomNav } from "@/components/BottomNav";
import { MetricCard } from "@/components/ui/MetricCard";
import { QuickEntryGrid } from "@/components/ui/QuickEntryGrid";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { getWriteAccess } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageFallback() {
  return (
    <main className="pb-24">
      <div className="h-16 animate-pulse bg-[var(--field-bg)]" />
      <div className="mx-4 mt-4 h-32 animate-pulse rounded-[var(--radius-card)] bg-[var(--field-bg)]" />
      <BottomNav active="home" />
    </main>
  );
}

async function HomePageContent() {
  const canWrite = await getWriteAccess();
  const [data, healthData] = await Promise.all([loadHomeData(), loadHerdHealthData()]);
  const { herd } = healthData;
  const farmName = data.farm_settings?.farm_name ?? DEFAULT_FARM_SETTINGS.farm_name ?? "My farm";
  const metrics = computeHerdMetrics(
    data.animals,
    data.lactations,
    data.breeding_events,
    data.medical_events
  );

  return (
    <main className="flex min-h-screen flex-col pb-24">
      <HomeHeader farmName={farmName} />

      {!canWrite && (
        <div className="px-4">
          <ViewOnlyBanner />
        </div>
      )}

      <div className="flex-1">
        <div className="px-4 pb-1">
          <p className="mb-2 text-base font-semibold text-[var(--text-primary)]">Today</p>
          <TodayAlerts actions={herd.actions} />
        </div>

        <div className="grid grid-cols-3 gap-2.5 px-4 py-2">
          <MetricCard label="Herd" value={metrics.totalActive} href="/animals" />
          <MetricCard label="In milk" value={metrics.inMilk} href="/animals?filter=in-milk" />
          <MetricCard label="Due soon" value={metrics.dueSoon} href="/animals?filter=due-soon" />
        </div>

        <div className="px-4 py-3">
          <p className="mb-2 text-base font-semibold text-[var(--text-primary)]">Quick entry</p>
          <QuickEntryGrid />
        </div>
      </div>

      <BottomNav active="home" />
    </main>
  );
}
