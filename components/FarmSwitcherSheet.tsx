import { useQuery } from '@powersync/react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HerdRow } from '@/components/ui/HerdRow';
import { Text } from '@/components/ui/Text';
import { useCloseOnBack } from '@/lib/navigation/use-close-on-back';
import { formatFarmRole } from '@/lib/ui/farm-labels';
import type { Farm, FarmMember } from '@/lib/types/tenancy';
import { useAuth } from '@/providers/AuthProvider';

type FarmSwitcherSheetProps = {
  visible: boolean;
  farms: Farm[];
  activeFarmId: string | null;
  onClose: () => void;
  onSelect: (farmId: string) => void;
};

function isFarmRole(role: string): role is FarmMember['role'] {
  switch (role) {
    case 'owner':
    case 'manager':
    case 'hand':
      return true;
    default:
      return false;
  }
}

export function FarmSwitcherSheet({
  visible,
  farms,
  activeFarmId,
  onClose,
  onSelect,
}: FarmSwitcherSheetProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  useCloseOnBack(visible, onClose);
  const { data: membershipRows } = useQuery<{ farm_id: string; role: string }>(
    user
      ? 'SELECT farm_id, role FROM farm_members WHERE lower(user_id) = lower(?)'
      : 'SELECT 1 WHERE 0',
    user ? [user.id] : [],
  );

  const roleByFarmId = new Map<string, FarmMember['role']>();
  for (const row of membershipRows ?? []) {
    const role = String(row.role ?? '');
    if (isFarmRole(role) && row.farm_id) {
      roleByFarmId.set(String(row.farm_id), role);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/55 justify-end" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="bg-paper rounded-t-[28px] max-h-[88%]"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <View className="w-11 h-1.5 rounded-full bg-gray-300 self-center mt-3 mb-3.5" />
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Text className="text-2xl font-extrabold text-ink">Farms</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              className="min-h-[48px] justify-center px-2">
              <Text className="text-base font-bold text-bloodline-600">Close</Text>
            </Pressable>
          </View>
          <ScrollView className="px-5" contentContainerClassName="pb-2">
            {farms.map((farm) => {
              const role = roleByFarmId.get(farm.id);
              return (
                <HerdRow
                  key={farm.id}
                  title={farm.name}
                  subtitle={role ? formatFarmRole(role) : undefined}
                  selected={farm.id === activeFarmId}
                  onPress={() => onSelect(farm.id)}
                />
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
