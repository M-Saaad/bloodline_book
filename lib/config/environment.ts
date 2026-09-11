import Constants from 'expo-constants';

export type AppEnvironment = 'development' | 'production';

function readAppEnv(): AppEnvironment {
  const fromPublic = process.env.EXPO_PUBLIC_APP_ENV;
  if (fromPublic === 'production' || fromPublic === 'development') {
    return fromPublic;
  }

  const fromExtra = Constants.expoConfig?.extra?.appEnv;
  if (fromExtra === 'production' || fromExtra === 'development') {
    return fromExtra;
  }

  return 'development';
}

export const appEnvironment = readAppEnv();
export const isDevelopment = appEnvironment === 'development';
export const isProduction = appEnvironment === 'production';

export const appDisplayName = isDevelopment
  ? 'Bloodline Book (Dev)'
  : 'Bloodline Book';
