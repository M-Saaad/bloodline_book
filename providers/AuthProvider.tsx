import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  isAcceptableAuthEmail,
  normalizeAuthEmail,
  recoveryParamsFromUrl,
} from '@/lib/auth/email';
import {
  isRecoveryTypeInInitialWebUrl,
  isRecoveryTypeInUrl,
  RECOVERY_PENDING_STORAGE_KEY,
  recoveryLinkErrorFromInitialWebUrl,
  recoveryLinkErrorFromUrl,
} from '@/lib/auth/recovery';
import {
  PASSWORD_RESET_REDIRECT_URL,
  SIGNUP_EMAIL_REDIRECT_URL,
} from '@/lib/config/app';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
  recoveryPending: boolean;
  recoveryLinkError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ sessionCreated: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readRecoveryPending(): Promise<boolean> {
  const value = await AsyncStorage.getItem(RECOVERY_PENDING_STORAGE_KEY);
  return value === '1';
}

async function writeRecoveryPending(pending: boolean): Promise<void> {
  if (pending) {
    await AsyncStorage.setItem(RECOVERY_PENDING_STORAGE_KEY, '1');
  } else {
    await AsyncStorage.removeItem(RECOVERY_PENDING_STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryLinkError, setRecoveryLinkError] = useState<string | null>(
    null,
  );
  const [recoveryHydrated, setRecoveryHydrated] = useState(false);

  const markRecoveryPending = useCallback(async () => {
    setRecoveryPending(true);
    await writeRecoveryPending(true);
  }, []);

  const clearRecoveryPending = useCallback(async () => {
    setRecoveryPending(false);
    setRecoveryLinkError(null);
    await writeRecoveryPending(false);
  }, []);

  const adoptRecoveryUrl = useCallback(
    async (url: string | null) => {
      if (!url || !isSupabaseConfigured) {
        return;
      }

      const linkError = recoveryLinkErrorFromUrl(url);
      if (linkError) {
        setRecoveryLinkError(linkError);
        return;
      }

      if (isRecoveryTypeInUrl(url)) {
        await markRecoveryPending();
      }

      const params = recoveryParamsFromUrl(url);
      try {
        if (params.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            params.code,
          );
          if (error) {
            throw error;
          }
          await markRecoveryPending();
          return;
        }
        if (params.accessToken && params.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken,
          });
          if (error) {
            throw error;
          }
          await markRecoveryPending();
        }
      } catch {
        setRecoveryLinkError(
          'This link has expired or was already used. Request a new one.',
        );
      }
    },
    [markRecoveryPending],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setRecoveryHydrated(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      const storedPending = await readRecoveryPending();
      if (!cancelled) {
        setRecoveryPending(storedPending);
      }

      if (Platform.OS === 'web') {
        const webLinkError = recoveryLinkErrorFromInitialWebUrl();
        if (webLinkError && !cancelled) {
          setRecoveryLinkError(webLinkError);
        } else if (isRecoveryTypeInInitialWebUrl() && !cancelled) {
          await markRecoveryPending();
        }
      }

      if (!cancelled) {
        setRecoveryHydrated(true);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [markRecoveryPending]);

  useEffect(() => {
    if (!isSupabaseConfigured || !recoveryHydrated) {
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        setSession(nextSession);
        if (event === 'PASSWORD_RECOVERY') {
          await markRecoveryPending();
        }
      },
    );

    void Linking.getInitialURL().then((url) => adoptRecoveryUrl(url));

    const linkListener = Linking.addEventListener('url', (event) => {
      void adoptRecoveryUrl(event.url);
    });

    return () => {
      listener.subscription.unsubscribe();
      linkListener.remove();
    };
  }, [adoptRecoveryUrl, markRecoveryPending, recoveryHydrated]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeAuthEmail(email),
        password,
      });
      if (error) {
        throw error;
      }
      await clearRecoveryPending();
    },
    [clearRecoveryPending],
  );

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeAuthEmail(email),
      password,
      options: {
        emailRedirectTo: SIGNUP_EMAIL_REDIRECT_URL,
      },
    });
    if (error) {
      throw error;
    }

    return { sessionCreated: data.session != null };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const normalized = normalizeAuthEmail(email);
    if (!isAcceptableAuthEmail(normalized)) {
      throw new Error('Enter the full email address you use to sign in.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: PASSWORD_RESET_REDIRECT_URL,
    });
    if (error) {
      throw error;
    }
  }, []);

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }
      await clearRecoveryPending();
    },
    [clearRecoveryPending],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    await clearRecoveryPending();
  }, [clearRecoveryPending]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isConfigured: isSupabaseConfigured,
      recoveryPending,
      recoveryLinkError,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [
      session,
      isLoading,
      recoveryPending,
      recoveryLinkError,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
