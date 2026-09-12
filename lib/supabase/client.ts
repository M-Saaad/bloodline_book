import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import {
  isValidSupabaseProjectUrl,
  normalizeSupabaseUrl,
  sanitizeSupabaseJwtKey,
} from '@/lib/supabase/config';

const authStorage: SupportedStorage =
  typeof window === 'undefined'
    ? {
        getItem: async () => null,
        setItem: async () => undefined,
        removeItem: async () => undefined,
      }
    : AsyncStorage;

const supabaseUrl = normalizeSupabaseUrl(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
);
const supabaseAnonKey = sanitizeSupabaseJwtKey(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
);

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.EXPO_PUBLIC_SUPABASE_URL.includes('your-project') &&
    isValidSupabaseProjectUrl(supabaseUrl),
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
