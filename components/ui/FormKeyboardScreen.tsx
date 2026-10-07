import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

type FormKeyboardScreenProps = ScrollViewProps & {
  screenClassName?: string;
};

/**
 * Scrollable form with keyboard avoidance so primary actions stay reachable.
 */
export function FormKeyboardScreen({
  children,
  className,
  screenClassName = 'flex-1 bg-gray-50',
  contentContainerClassName,
  keyboardShouldPersistTaps = 'handled',
  ...rest
}: FormKeyboardScreenProps) {
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
    </KeyboardAvoidingView>
  );
}
