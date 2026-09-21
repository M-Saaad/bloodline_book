import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import {
  formatDisplayDate,
  formatIsoDate,
  parseIsoDate,
  todayIso,
} from '@/lib/dates';

type WebDateInputProps = TextInputProps & {
  type?: 'date';
};

export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  optional?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
}

const fieldClassName =
  'border border-gray-300 rounded-xl px-4 py-3 text-base bg-white text-gray-900';

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  optional = false,
  minimumDate,
  maximumDate,
}: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerDate = parseIsoDate(value) ?? parseIsoDate(todayIso())!;

  function handleNativeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'set' && selected) {
      onChange(formatIsoDate(selected));
    }
    if (Platform.OS === 'ios' && event.type === 'dismissed') {
      setShowPicker(false);
    }
  }

  const displayValue = value ? formatDisplayDate(value) : '';

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
        {optional && value ? (
          <Pressable
            onPress={() => onChange('')}
            accessibilityRole="button"
            hitSlop={8}>
            <Text className="text-sm font-medium text-bloodline-600">Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {Platform.OS === 'web' ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          className={fieldClassName}
          placeholderTextColor="#9ca3af"
          {...({ type: 'date' } as WebDateInputProps)}
        />
      ) : (
        <>
          <Pressable
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
            className={fieldClassName}>
            <Text
              className={`text-base ${
                value ? 'text-gray-900' : 'text-gray-400'
              }`}>
              {displayValue || placeholder}
            </Text>
          </Pressable>
          {showPicker ? (
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={handleNativeChange}
            />
          ) : null}
        </>
      )}
    </View>
  );
}
