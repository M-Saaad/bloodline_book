import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { FarmRoleStatusBanner } from '@/components/FarmRoleStatusBanner';
import { ScreenHeading } from '@/components/breeding/parts';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { Text } from '@/components/ui/Text';
import { useFarmRole } from '@/hooks/useFarmRole';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { markDoeOpenForSeason } from '@/lib/db/fast-kidding';
import { mapAnimal } from '@/lib/db/mappers';
import {
  KIDDING_SEASON_MARKS_READY_SQL,
  notKiddedYet,
  notKiddedYetLabel,
  resolveKiddingSeasonStart,
} from '@/lib/domain/fast-kidding';
import { confirmAction } from '@/lib/ui/confirm';
import { compareHerdOrder } from '@/lib/ui/animal-picker';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function NotKiddedScreen() {
  const { activeFarm } = useFarm();
  const { canWrite } = useFarmRole();
  const [errorMessage, setErrorMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = todayIso();
  const seasonStart = activeFarm
    ? resolveKiddingSeasonStart(activeFarm.kiddingSeasonStart, today)
    : today;

  const { data: animalRows } = useQuery(
    activeFarm ? 'SELECT * FROM animals WHERE farm_id = ?' : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );
  const { data: kiddingRows } = useQuery(
    activeFarm
      ? 'SELECT dam_id, kid_date FROM kidding_events WHERE farm_id = ?'
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );
  const { data: readyRows } = useQuery(KIDDING_SEASON_MARKS_READY_SQL);
  const marksReady =
    (readyRows?.[0] as { name?: string } | undefined)?.name ===
    'kidding_season_marks';
  const { data: markRows } = useQuery(
    activeFarm && marksReady
      ? `SELECT animal_id, season_start FROM kidding_season_marks
         WHERE farm_id = ? AND season_start = ?`
      : 'SELECT 1 WHERE 0',
    activeFarm && marksReady ? [activeFarm.id, seasonStart] : [],
  );

  const does = useMemo(() => {
    const animals = (animalRows ?? []).map((row) =>
      mapAnimal(row as Record<string, unknown>),
    );
    const listed = notKiddedYet(
      animals,
      (kiddingRows ?? []).map((row) => {
        const record = row as { dam_id?: string; kid_date?: string };
        return {
          damId: String(record.dam_id ?? ''),
          kidDate: String(record.kid_date ?? ''),
        };
      }),
      marksReady
        ? (markRows ?? []).map((row) => {
            const record = row as { animal_id?: string; season_start?: string };
            return {
              animalId: String(record.animal_id ?? ''),
              seasonStart: String(record.season_start ?? '').slice(0, 10),
            };
          })
        : [],
      seasonStart,
    );
    return [...listed].sort(compareHerdOrder);
  }, [animalRows, kiddingRows, markRows, marksReady, seasonStart]);

  async function markOpen(animalId: string, label: string) {
    if (!activeFarm || !canWrite) {
      return;
    }
    const proceed = await confirmAction(
      'Not bred this season?',
      `${label} leaves the not-kidded list until next season.`,
      'Mark open',
    );
    if (!proceed) {
      return;
    }
    setErrorMessage('');
    setBusyId(animalId);
    try {
      await markDoeOpenForSeason(activeFarm.id, animalId, seasonStart);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not mark her open.',
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="px-5 pb-10">
      <ScreenHeading
        title={notKiddedYetLabel(does.length)}
        subtitle={`Since ${formatDisplayDate(seasonStart)}`}
      />
      <View className="mt-3">
        <FarmRoleStatusBanner />
      </View>
      {!marksReady ? (
        <View className="mt-3">
          <Banner
            tone="amber"
            title="Open marks are still syncing"
            message="The list of does who have not kidded is here. Marking one open waits until that list finishes syncing."
          />
        </View>
      ) : null}
      <View className="mt-3">
        <FormMessage message={errorMessage} tone="error" />
      </View>
      {does.length === 0 ? (
        <EmptyState
          title="No does left"
          description="Every breeding or adult doe has kidded, or been marked open, since this season started."
        />
      ) : (
        <View className="mt-2 bg-white border border-gray-200 rounded-[22px] overflow-hidden">
          {does.map((doe, index) => {
            const label = animalDisplayLabel(doe);
            return (
              <View
                key={doe.id}
                className={`flex-row items-stretch ${
                  index === does.length - 1 ? '' : 'border-b border-gray-100'
                }`}>
                <Pressable
                  accessibilityRole="button"
                  disabled={!canWrite}
                  onPress={() => {
                    if (!canWrite) {
                      return;
                    }
                    router.push({
                      pathname: '/(tabs)/more/breeding/add-kidding',
                      params: { damId: doe.id },
                    });
                  }}
                  className="flex-1 min-h-[72px] justify-center px-4 py-3 active:bg-gray-50">
                  <Text className="text-lg font-extrabold text-ink">{label}</Text>
                  {canWrite ? (
                    <Text className="text-base text-gray-500">Tap to log kidding</Text>
                  ) : null}
                </Pressable>
                {canWrite && marksReady ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyId === doe.id}
                    onPress={() => void markOpen(doe.id, label)}
                    className="min-h-[72px] min-w-[88px] items-center justify-center px-3 active:bg-gray-50">
                    <Text className="text-lg font-extrabold text-bloodline-600">
                      {busyId === doe.id ? '…' : 'Open'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
