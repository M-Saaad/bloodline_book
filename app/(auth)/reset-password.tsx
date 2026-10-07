import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import {
  AUTH_PASSWORD_HINT,
  mapAuthErrorMessage,
} from '@/lib/auth/errors';
import { recoveryParamsFromUrl } from '@/lib/auth/email';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/providers/AuthProvider';

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function adoptUrl(url: string | null) {
      if (!url || cancelled) {
        return;
      }
      const params = recoveryParamsFromUrl(url);
      try {
        if (params.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) {
            throw error;
          }
          if (!cancelled) {
            setReady(true);
          }
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
          if (!cancelled) {
            setReady(true);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLinkError(mapAuthErrorMessage(error));
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !cancelled) {
        setReady(true);
      }
    });

    Linking.getInitialURL().then((url) => {
      void adoptUrl(url);
    });

    const linkListener = Linking.addEventListener('url', (event) => {
      void adoptUrl(event.url);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      linkListener.remove();
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSavePassword() {
    setErrorMessage('');

    if (!password || password.length < 8) {
      setErrorMessage('Enter a new password (at least 8 characters).');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      router.replace('/');
    } catch (error) {
      setErrorMessage(mapAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <FormKeyboardScreen contentContainerClassName="px-6 py-8">
        <FormMessage message={linkError} tone="error" />
        <Text className="text-gray-700">
          Open the password reset link from your email to continue.
        </Text>
      </FormKeyboardScreen>
    );
  }

  return (
    <FormKeyboardScreen contentContainerClassName="px-6 py-8">
      <Text className="text-2xl font-bold text-bloodline-800 mb-2">
        Choose a new password
      </Text>
      <Text className="text-gray-600 mb-6">
        This link expires soon. Pick a password you have not used here before.
      </Text>

      <FormMessage message={errorMessage} tone="error" />

      <Input
        label="New password"
        value={password}
        onChangeText={setPassword}
        hint={AUTH_PASSWORD_HINT}
        secureTextEntry
        autoCapitalize="none"
      />
      <Input
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        hint={AUTH_PASSWORD_HINT}
        secureTextEntry
        autoCapitalize="none"
      />

      <Button
        title={loading ? 'Saving…' : 'Update password'}
        onPress={handleSavePassword}
        disabled={loading}
        className="mt-2"
      />
    </FormKeyboardScreen>
  );
}
