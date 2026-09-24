import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/providers/AuthProvider';

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
      }
    });

    return () => {
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
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not update password.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="px-6 py-8">
        <Text className="text-gray-700">
          Open the password reset link from your email to continue.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-6 py-8">
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
        secureTextEntry
        autoCapitalize="none"
      />
      <Input
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <Button
        title={loading ? 'Saving…' : 'Update password'}
        onPress={handleSavePassword}
        disabled={loading}
        className="mt-2"
      />
    </ScrollView>
  );
}
