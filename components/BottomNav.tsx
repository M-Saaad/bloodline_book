import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuickAddSheet } from '@/components/QuickAddSheet';
import { useFarmRole } from '@/hooks/useFarmRole';
import { Text } from '@/components/ui/Text';

type Item = { key: 'today' | 'herd' | 'breeding' | 'more'; label: string; symbol: string; href: string };

const LEFT: Item[] = [
  { key: 'today', label: 'Today', symbol: '⌂', href: '/(tabs)/dashboard' },
  { key: 'herd', label: 'Herd', symbol: '☰', href: '/(tabs)/livestock' },
];
const RIGHT: Item[] = [
  { key: 'breeding', label: 'Breeding', symbol: '♡', href: '/(tabs)/more/breeding' },
  { key: 'more', label: 'More', symbol: '⋯', href: '/(tabs)/more' },
];

function activeKey(pathname: string): Item['key'] {
  if (pathname.startsWith('/dashboard')) return 'today';
  if (pathname.startsWith('/livestock')) return 'herd';
  if (pathname.startsWith('/more/breeding')) return 'breeding';
  return 'more';
}

/**
 * Today, Herd, plus, Breeding, More. Land, Money, Health, Tasks and Papers live in More.
 * The plus button opens the Quick add sheet and is hidden for view-only roles.
 */
export function BottomNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { canWrite } = useFarmRole();
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = activeKey(pathname);

  function renderItem(item: Item) {
    const on = item.key === active;
    return (
      <Pressable
        key={item.key}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => {
          if (item.key === 'more' && on) {
            router.navigate('/(tabs)/more' as never);
            return;
          }
          router.navigate(item.href as never);
        }}
        className="flex-1 min-w-[68px] min-h-[52px] items-center gap-0.5">
        <Text className={`text-[26px] leading-[30px] ${on ? 'text-bloodline-600' : 'text-gray-500'}`}>
          {item.symbol}
        </Text>
        <Text
          numberOfLines={1}
          className={`text-[13px] ${on ? 'font-extrabold text-bloodline-600' : 'font-semibold text-gray-500'}`}>
          {item.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      className="bg-white border-t border-gray-200 flex-row items-start justify-around px-1.5 pt-2.5"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
      {LEFT.map(renderItem)}
      {canWrite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick add"
          onPress={() => setSheetOpen(true)}
          className="w-16 h-16 rounded-full bg-bloodline-600 items-center justify-center -mt-[22px] active:bg-bloodline-700"
          style={{ shadowColor: '#a52f1a', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
          <Text className="text-white text-[36px] leading-[40px] font-light">＋</Text>
        </Pressable>
      ) : (
        <View className="w-16" />
      )}
      {RIGHT.map(renderItem)}
      <QuickAddSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}
