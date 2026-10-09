import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Banner } from '@/components/ui/Banner';

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
import { Text } from '@/components/ui/Text';

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
      <FormKeyboardScreen contentContainerClassName="px-5 pt-5 pb-8">
        <FormMessage message={linkError} tone="error" />
        <Banner
          tone="amber"
          title="Link did not work?"
          message="Open the password reset link from your email to continue."
        />
      </FormKeyboardScreen>
    );
  }

  return (
    <FormKeyboardScreen contentContainerClassName="px-5 pt-5 pb-8">
      <View className="px-1 mb-5">
        <Text className="text-[30px] leading-9 font-extrabold text-ink mb-2">
          Choose a new password
        </Text>
        <Text className="text-[17px] leading-6 text-gray-500">
          This link expires soon. Pick a password you have not used here before.
        </Text>
      </View>

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
