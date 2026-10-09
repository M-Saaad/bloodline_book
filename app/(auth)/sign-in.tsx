import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { AUTH_PASSWORD_HINT, mapAuthErrorMessage } from '@/lib/auth/errors';
import { isAcceptableAuthEmail, normalizeAuthEmail } from '@/lib/auth/email';
import { useAuth } from '@/providers/AuthProvider';
import { Text } from '@/components/ui/Text';

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
    <FormKeyboardScreen contentContainerClassName="px-5 pt-16 pb-8">
      <View className="px-1 mb-6">
        <View className="mb-3">
          <BrandMark size={52} />
        </View>
        <Text className="text-[34px] leading-[38px] font-extrabold text-bloodline-900 mb-2">
          Bloodline Book
        </Text>
        <Text className="text-[17px] leading-6 text-gray-500">
          Herd records for dairy and meat goat operations.
        </Text>
      </View>

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
        className="mb-3 min-h-[48px] justify-center">
        <Text className="text-bloodline-600 font-bold text-base">
          {resetLoading ? 'Sending reset email…' : 'Forgot password?'}
        </Text>
      </Pressable>

      <Button
        title={loading ? 'Signing in…' : 'Sign In'}
        onPress={handleSignIn}
        disabled={loading}
        className="mt-2"
      />

      <View className="mt-5 flex-row justify-center items-center">
        <Text className="text-[17px] text-gray-500">No account? </Text>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable className="min-h-[48px] justify-center">
            <Text className="text-base text-bloodline-600 font-bold">Create one</Text>
          </Pressable>
        </Link>
      </View>
      <Text className="mt-2 text-[15px] text-gray-500 text-center">
        ◔ Works without signal after you sign in once
      </Text>
    </FormKeyboardScreen>
  );
}
