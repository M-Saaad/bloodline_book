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

const resolvedSupabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  '';
const resolvedSupabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';

const supabaseUrl = normalizeSupabaseUrl(
  resolvedSupabaseUrl || 'https://placeholder.supabase.co',
);
const supabaseAnonKey = sanitizeSupabaseJwtKey(
  resolvedSupabaseAnonKey || 'placeholder-anon-key',
);

export const isSupabaseConfigured = Boolean(
  resolvedSupabaseUrl &&
    resolvedSupabaseAnonKey &&
    !resolvedSupabaseUrl.includes('your-project') &&
    !resolvedSupabaseUrl.includes('your-prod-project') &&
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
