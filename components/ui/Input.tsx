import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  /** Shown under the field with a warning symbol. */
  error?: string;
  /** Adds "optional" next to the label. */
  optional?: boolean;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  optional = false,
  secureTextEntry,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const border = error
    ? 'border-2 border-stop'
    : focused
      ? 'border-2 border-bloodline-600'
      : 'border border-gray-300';

  return (
    <View className="mb-4">
      <Text className="text-base font-bold text-ink mb-2">
        {label}
        {optional ? <Text className="font-medium text-gray-500"> optional</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`${border} rounded-[18px] px-4 text-lg bg-white text-ink ${
          multiline ? 'min-h-[96px] py-3' : 'h-14'
        }`}
        style={multiline ? { textAlignVertical: 'top' } : undefined}
        placeholderTextColor="#8a7b75"
      />
      {error ? (
        <Text className="text-[15px] font-bold text-stop mt-1.5">⚠ {error}</Text>
      ) : hint ? (
        <Text className="text-[15px] text-gray-500 mt-1.5">{hint}</Text>
      ) : null}
    </View>
  );
}
