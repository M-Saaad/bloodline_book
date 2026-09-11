import Constants from 'expo-constants';

export type DatabaseTarget = 'development' | 'production';

function readDatabaseTarget(): DatabaseTarget {
  const fromPublic = process.env.EXPO_PUBLIC_DATABASE_TARGET;
  if (fromPublic === 'production' || fromPublic === 'development') {
    return fromPublic;
  }

  const fromExtra = Constants.expoConfig?.extra?.databaseTarget;
  if (fromExtra === 'production' || fromExtra === 'development') {
    return fromExtra;
  }

  return 'development';
}

export const databaseTarget = readDatabaseTarget();
export const isDevelopmentDatabase = databaseTarget === 'development';
export const isProductionDatabase = databaseTarget === 'production';

export const databaseLabel =
  databaseTarget === 'production' ? 'Production DB' : 'Development DB';
