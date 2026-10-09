import { cssInterop } from 'nativewind';
import {
  StyleSheet,
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { useTextScale } from '@/lib/store/text-size';
import { scaleFontStyle, systemFontCap } from '@/lib/ui/text-scale';

export type TextProps = RNTextProps & {
  className?: string;
};

/**
 * Drop-in replacement for react-native's Text that follows the farmer's
 * "Text size" setting. Use this instead of importing Text from react-native.
 */
export function Text({ style, maxFontSizeMultiplier, ...rest }: TextProps) {
  const scale = useTextScale();
  const flat = StyleSheet.flatten(style as StyleProp<TextStyle>);
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? systemFontCap(scale)}
      style={scaleFontStyle(flat, scale)}
    />
  );
}

// Let NativeWind resolve className into style before we scale it.
cssInterop(Text, { className: 'style' });
