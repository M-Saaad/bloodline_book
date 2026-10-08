import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FormKeyboardScreenProps = ScrollViewProps & {
  screenClassName?: string;
  /** Pinned under the form, usually the Save button. */
  footer?: ReactNode;
};

/**
 * Scrollable form with keyboard avoidance so primary actions stay reachable.
 * With `footer`, the Save button is pinned at thumb height.
 */
export function FormKeyboardScreen({
  children,
  className,
  screenClassName = 'flex-1 bg-paper',
  contentContainerClassName,
  keyboardShouldPersistTaps = 'handled',
  footer,
  ...rest
}: FormKeyboardScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={screenClassName}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView
        className={className ?? 'flex-1'}
        contentContainerClassName={contentContainerClassName}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...rest}>
        {children}
      </ScrollView>
      {footer ? (
        <View
          className="bg-white border-t border-gray-200 px-5 pt-3.5"
          style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
