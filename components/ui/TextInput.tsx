import { cssInterop } from 'nativewind';
import {
  StyleSheet,
  TextInput as RNTextInput,
  type StyleProp,
  type TextInputProps as RNTextInputProps,
  type TextStyle,
} from 'react-native';

import { useTextScale } from '@/lib/store/text-size';
import { scaleFontStyle, systemFontCap } from '@/lib/ui/text-scale';

export type TextInputProps = RNTextInputProps & {
  className?: string;
};

/** TextInput that follows the "Text size" setting, like ui/Text. */
export function TextInput({
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextInputProps) {
  const scale = useTextScale();
  const flat = StyleSheet.flatten(style as StyleProp<TextStyle>);
  return (
    <RNTextInput
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? systemFontCap(scale)}
      style={scaleFontStyle(flat, scale)}
    />
  );
}

cssInterop(TextInput, { className: 'style' });
