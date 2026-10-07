import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { AUTH_PASSWORD_HINT, mapAuthErrorMessage } from '@/lib/auth/errors';
import { isAcceptableAuthEmail, normalizeAuthEmail } from '@/lib/auth/email';
import { useAuth } from '@/providers/AuthProvider';

export default function SignInScreen() {
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const { signIn, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const noticeMessage =
    typeof notice === 'string' && notice.trim() ? notice.trim() : '';

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
      setErrorMessage(mapAuthErrorMessage(error));
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
    if (!isAcceptableAuthEmail(normalized)) {
      setErrorMessage('Enter the full email address you use to sign in.');
      return;
    }

    setResetLoading(true);
    try {
      await requestPasswordReset(normalized);
      setResetSent(true);
    } catch (error) {
      setErrorMessage(mapAuthErrorMessage(error));
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <FormKeyboardScreen contentContainerClassName="px-6 py-8">
      <Text className="text-3xl font-bold text-bloodline-800 mb-2">
        Bloodline Book
      </Text>
      <Text className="text-gray-600 mb-8">
        Herd records for dairy and meat goat operations.
      </Text>

      <FormMessage message={errorMessage} tone="error" />
      {noticeMessage ? (
        <FormMessage message={noticeMessage} tone="success" />
      ) : null}
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
        hint={AUTH_PASSWORD_HINT}
        secureTextEntry
        autoCapitalize="none"
      />

      <Pressable
        onPress={handleForgotPassword}
        disabled={resetLoading}
        className="mb-3 min-h-[44px] justify-center">
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
    </FormKeyboardScreen>
  );
}
