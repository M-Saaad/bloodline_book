import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

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
    <FormKeyboardScreen contentContainerClassName="px-6 py-8">
      <Text className="text-2xl font-bold text-bloodline-800 mb-2">
        Create your account
      </Text>
      <Text className="text-gray-600 mb-8">
        Start managing your herd with offline-capable records.
      </Text>

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
        title={loading ? 'Creating…' : 'Create Account'}
        onPress={handleSignUp}
        disabled={loading}
        className="mt-2"
      />

      <Text className="text-base text-gray-500 leading-6 mt-4">
        Your herd records belong to you. They are stored with Supabase in{' '}
        {DATA_REGION}. They are never sold or shared. Email {SUPPORT_EMAIL} any
        time to get a full export or have everything deleted.
      </Text>

      <View className="mt-6 flex-row justify-center">
        <Text className="text-gray-600">Already have an account? </Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable>
            <Text className="text-bloodline-600 font-semibold">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </FormKeyboardScreen>
  );
}
