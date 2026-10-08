import { router } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tile = { label: string; symbol: string; href: string };

// The jobs done most often. Two taps from anywhere: plus, then the job.
const TILES: Tile[] = [
  { label: 'Weigh goats', symbol: '⚖', href: '/(tabs)/livestock/weight' },
  { label: 'Treatment', symbol: '✚', href: '/(tabs)/more/health/add' },
  { label: 'Kidding', symbol: '♥', href: '/(tabs)/more/breeding/add-kidding' },
  { label: 'Move pasture', symbol: '➜', href: '/(tabs)/land/add-grazing' },
  { label: 'Breeding', symbol: '♡', href: '/(tabs)/more/breeding/add-breeding' },
  { label: 'Add goat', symbol: '＋', href: '/(tabs)/livestock/add' },
];

export function QuickAddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/55 justify-end" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="bg-paper rounded-t-[28px] px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <View className="w-11 h-1.5 rounded-full bg-gray-300 self-center mb-4" />
          <Text className="text-2xl font-extrabold text-ink mb-4">What did you do?</Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {TILES.map((tile) => (
              <Pressable
                key={tile.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  router.push(tile.href as never);
                }}
                className="w-[48%] min-h-[96px] rounded-[22px] bg-white border border-gray-200 px-4 py-3 justify-between active:bg-bloodline-50">
                <Text className="text-[28px] text-bloodline-600">{tile.symbol}</Text>
                <Text className="text-lg font-extrabold text-ink">{tile.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
