import { Alert, Platform } from 'react-native';

/** Cross-platform alert — React Native Web's Alert.alert is often a no-op. */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }

  Alert.alert(title, message);
}
