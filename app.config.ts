import type { ConfigContext, ExpoConfig } from 'expo/config';

type AppEnvironment = 'development' | 'production';

function resolveAppEnv(): AppEnvironment {
  const value =
    process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? 'development';
  return value === 'production' ? 'production' : 'development';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appEnv = resolveAppEnv();
  const isDev = appEnv === 'development';

  return {
    ...config,
    name: isDev ? 'Bloodline Book (Dev)' : 'Bloodline Book',
    slug: isDev ? 'bloodline-book-dev' : 'bloodline-book',
    scheme: isDev ? 'bloodlinebook-dev' : 'bloodlinebook',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: isDev
        ? 'com.bloodlinebook.dev'
        : 'com.bloodlinebook.app',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      package: isDev ? 'com.bloodlinebook.dev' : 'com.bloodlinebook.app',
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
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
    extra: {
      appEnv,
    },
  };
};
