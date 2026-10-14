import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import {
  AUTH_PASSWORD_HINT,
  mapAuthErrorMessage,
} from '@/lib/auth/errors';
import { useAuth } from '@/providers/AuthProvider';
import { Text } from '@/components/ui/Text';

export default function ResetPasswordScreen() {
  const {
    updatePassword,
    recoveryPending,
    recoveryLinkError,
    session,
    isLoading,
  } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  if (recoveryLinkError) {
    return (
      <FormKeyboardScreen contentContainerClassName="px-5 pt-5 pb-8">
        <FormMessage message={recoveryLinkError} tone="error" />
        <Button
          title="Back to sign in"
          className="mt-4"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
        <Button
          title="Forgot password?"
          variant="secondary"
          className="mt-2"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </FormKeyboardScreen>
    );
  }

  if (isLoading || (recoveryPending && !session)) {
    return (
      <FormKeyboardScreen contentContainerClassName="px-5 pt-5 pb-8">
        <Text className="text-[17px] leading-6 text-gray-500">
          Opening your reset link…
        </Text>
      </FormKeyboardScreen>
    );
  }

  if (!recoveryPending || !session) {
    return (
      <FormKeyboardScreen contentContainerClassName="px-5 pt-5 pb-8">
        <FormMessage
          message="This link has expired or was already used. Request a new one."
          tone="error"
        />
        <Button
          title="Back to sign in"
          className="mt-4"
          onPress={() => router.replace('/(auth)/sign-in')}
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
