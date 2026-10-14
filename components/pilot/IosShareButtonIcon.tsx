import { View } from 'react-native';

/**
 * Simple stand-in for the iOS Safari Share control (not a fake screenshot).
 */
export function IosShareButtonIcon() {
  return (
    <View
      accessibilityLabel="Share button"
      className="w-[52px] h-[52px] rounded-xl border-2 border-gray-400 bg-white items-center justify-center">
      <View className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[12px] border-l-transparent border-r-transparent border-b-gray-700 mb-0.5" />
      <View className="w-[18px] h-[2px] bg-gray-700 rounded-full" />
    </View>
  );
}
