import { Text, View } from 'react-native';

export type BannerTone = 'amber' | 'stop' | 'green' | 'blue' | 'blush';

const TONES: Record<BannerTone, { box: string; title: string; body: string; symbol: string }> = {
  amber: { box: 'bg-[#fff1cc]', title: 'text-[#6b3a00]', body: 'text-[#6b3a00]', symbol: '◔' },
  stop: { box: 'bg-stop', title: 'text-white', body: 'text-[#f0eae5]', symbol: '⚠' },
  green: { box: 'bg-[#ddf0e4]', title: 'text-[#0f5a33]', body: 'text-[#0f5a33]', symbol: '✓' },
  blue: { box: 'bg-[#e1edf8]', title: 'text-[#17476f]', body: 'text-[#17476f]', symbol: 'ⓘ' },
  blush: { box: 'bg-bloodline-100', title: 'text-bloodline-900', body: 'text-bloodline-900', symbol: '⚠' },
};

type BannerProps = {
  title: string;
  message?: string;
  tone?: BannerTone;
};

/** Icon + words + color. Black (`stop`) means something blocks you. */
export function Banner({ title, message, tone = 'amber' }: BannerProps) {
  const t = TONES[tone];
  return (
    <View
      accessibilityRole="alert"
      className={`flex-row items-center gap-3.5 rounded-[20px] px-4 py-3.5 min-h-[72px] ${t.box}`}>
      <Text className={`text-[26px] ${t.title}`}>{t.symbol}</Text>
      <View className="flex-1">
        <Text className={`text-lg font-extrabold ${t.title}`}>{title}</Text>
        {message ? <Text className={`text-[15px] leading-5 ${t.body}`}>{message}</Text> : null}
      </View>
    </View>
  );
}
