import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import {
  AUTH_PASSWORD_HINT,
  mapAuthErrorMessage,
} from '@/lib/auth/errors';
import { isAcceptableAuthEmail, normalizeAuthEmail } from '@/lib/auth/email';
import { DATA_REGION, SUPPORT_EMAIL } from '@/lib/config/support';
import { useAuth } from '@/providers/AuthProvider';
import { Text } from '@/components/ui/Text';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSignUp() {
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    const normalized = normalizeAuthEmail(email);
    if (!isAcceptableAuthEmail(normalized)) {
      setErrorMessage('Enter a valid email address (for example you@farm.com).');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Use a password with at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { sessionCreated } = await signUp(email.trim(), password);

      if (sessionCreated) {
        router.replace('/');
        return;
      }

      router.replace({
        pathname: '/(auth)/sign-in',
        params: {
          notice:
            'Account created. Check your email to confirm your address, then sign in.',
        },
      });
    } catch (error) {
      setErrorMessage(mapAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormKeyboardScreen contentContainerClassName="px-5 pt-5 pb-8">
      <View className="px-1 mb-5">
        <View className="mb-3">
          <BrandMark size={52} />
        </View>
        <Text className="text-[34px] leading-[38px] font-extrabold text-bloodline-900 mb-2">
          Bloodline Book
        </Text>
        <Text className="text-[30px] leading-9 font-extrabold text-ink mb-2">
          Create your account
        </Text>
        <Text className="text-[17px] leading-6 text-gray-500">
          Start managing your herd with offline-capable records.
        </Text>
      </View>

      <FormMessage message={errorMessage} tone="error" />

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

      <Button
        title={loading ? 'Creating…' : 'Create account'}
        onPress={handleSignUp}
        disabled={loading}
        className="mt-2"
      />

      <View className="mt-4 bg-white border border-gray-200 rounded-[22px] px-4 py-3.5 flex-row gap-3">
        <Text className="text-2xl text-gray-500">⌂</Text>
        <Text className="flex-1 text-[15px] leading-[22px] text-gray-500">
          Your herd records belong to you. They are stored with Supabase in{' '}
          {DATA_REGION}. They are never sold or shared. Email {SUPPORT_EMAIL} any
          time to get a full export or have everything deleted.
        </Text>
      </View>

      <View className="mt-5 flex-row flex-wrap justify-center items-center">
        <Text className="text-[17px] text-gray-500">Already have an account? </Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable className="min-h-[48px] justify-center">
            <Text className="text-base text-bloodline-600 font-bold">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </FormKeyboardScreen>
  );
}
