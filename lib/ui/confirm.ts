import { Alert, Platform } from 'react-native';

export function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(window.confirm(text));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: () => resolve(true),
      },
    ]);
  });
}
