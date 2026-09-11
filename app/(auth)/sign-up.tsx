import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/providers/AuthProvider';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSignUp() {
    setErrorMessage('');
    setSuccessMessage('');

    if (!email || !password) {
      setErrorMessage('Enter your email and password.');
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

      setSuccessMessage(
        'Account created. Check your email to confirm, then sign in.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Sign up failed. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-6 py-8">
      <Text className="text-2xl font-bold text-bloodline-800 mb-2">
        Create your account
      </Text>
      <Text className="text-gray-600 mb-8">
        Start managing your herd with offline-capable records.
      </Text>

      <FormMessage message={errorMessage} tone="error" />
      <FormMessage message={successMessage} tone="success" />

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
        placeholder="At least 8 characters"
        secureTextEntry
        autoCapitalize="none"
      />

      <Button
        title={loading ? 'Creating…' : 'Create Account'}
        onPress={handleSignUp}
        disabled={loading}
        className="mt-2"
      />

      <View className="mt-6 flex-row justify-center">
        <Text className="text-gray-600">Already have an account? </Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable>
            <Text className="text-bloodline-600 font-semibold">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}
