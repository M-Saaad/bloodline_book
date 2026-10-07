import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Bloodline Book',
  owner: 'bloodline-books-team',
  slug: 'blood-line-book-app',
  scheme: 'bloodlinebook',
  extra: {
    eas: {
      projectId: 'b3bb8e1d-c845-4c51-a31c-f26f59ee6512',
    },
  },
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.bloodlinebook.app',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    package: 'com.bloodlinebook.app',
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    '@react-native-community/datetimepicker',
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
