import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/providers/AuthProvider';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (error) {
      Alert.alert(
        'Sign in failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setLoading(false);
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
