import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { normalizeAuthEmail } from '@/lib/auth/email';
import { useAuth } from '@/providers/AuthProvider';

export default function SignInScreen() {
  const { signIn, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSignIn() {
    setErrorMessage('');
    setResetSent(false);

    if (!email || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Sign in failed. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setErrorMessage('');
    setResetSent(false);

    const normalized = normalizeAuthEmail(email);
    if (!normalized) {
      setErrorMessage('Enter your email first, then tap Forgot password.');
      return;
    }

    setResetLoading(true);
    try {
      await requestPasswordReset(normalized);
      setResetSent(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not send reset email. Try again.',
      );
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-6 py-8">
      <Text className="text-3xl font-bold text-bloodline-800 mb-2">
        Bloodline Book
      </Text>
      <Text className="text-gray-600 mb-8">
        Herd records for dairy and meat goat operations.
      </Text>

      <FormMessage message={errorMessage} tone="error" />
      {resetSent ? (
        <FormMessage
          message="Check your email for a password reset link."
          tone="success"
        />
      ) : null}

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@farm.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
      />

      <Pressable onPress={handleForgotPassword} disabled={resetLoading} className="mb-3">
        <Text className="text-bloodline-600 font-semibold text-sm">
          {resetLoading ? 'Sending reset email…' : 'Forgot password?'}
        </Text>
      </Pressable>

      <Button
        title={loading ? 'Signing in…' : 'Sign In'}
        onPress={handleSignIn}
        disabled={loading}
        className="mt-2"
      />

      <View className="mt-6 flex-row justify-center">
        <Text className="text-gray-600">No account? </Text>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable>
            <Text className="text-bloodline-600 font-semibold">Sign up</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}
