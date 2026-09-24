import { Pressable, Text, View } from 'react-native';

import { Input } from '@/components/ui/Input';
import {
  FAMACHA_SCORE_3_HINT,
  showsMilkWithdrawal,
  WITHDRAWAL_VET_HINT,
  type RememberedProduct,
} from '@/lib/domain/health';
import type { TreatmentRoute } from '@/lib/types/health';
import type { Farm } from '@/lib/types/tenancy';

const ROUTES: { value: TreatmentRoute; label: string }[] = [
  { value: 'oral', label: 'Oral' },
  { value: 'sc', label: 'SC injection' },
  { value: 'im', label: 'IM injection' },
  { value: 'topical', label: 'Topical' },
  { value: 'other', label: 'Other' },
];

type TreatmentFieldsProps = {
  segment: Farm['segment'];
  showWithdrawal: boolean;
  famachaScore: number | null;
  productName: string;
  onProductName: (value: string) => void;
  dosage: string;
  onDosage: (value: string) => void;
  route: TreatmentRoute | null;
  onRoute: (value: TreatmentRoute | null) => void;
  lotNumber: string;
  onLotNumber: (value: string) => void;
  meatDays: string;
  onMeatDays: (value: string) => void;
  milkDays: string;
  onMilkDays: (value: string) => void;
  remembered: RememberedProduct[];
  onPickProduct: (product: RememberedProduct) => void;
};

export function TreatmentFields({
  segment,
  showWithdrawal,
  famachaScore,
  productName,
  onProductName,
  dosage,
  onDosage,
  route,
  onRoute,
  lotNumber,
  onLotNumber,
  meatDays,
  onMeatDays,
  milkDays,
  onMilkDays,
  remembered,
  onPickProduct,
}: TreatmentFieldsProps) {
  const showMilk = showsMilkWithdrawal(segment);

  return (
    <View>
      {famachaScore === 3 ? (
        <Text className="text-sm text-amber-800 mb-4">{FAMACHA_SCORE_3_HINT}</Text>
      ) : null}

      <Input
        label="Product / medication"
        value={productName}
        onChangeText={onProductName}
        placeholder="Optional"
      />
      {remembered.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 mb-4 -mt-2">
          {remembered.map((product) => (
            <Pressable
              key={product.productName}
              onPress={() => onPickProduct(product)}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5">
              <Text className="text-sm text-gray-700">{product.productName}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Input
        label="Dosage"
        value={dosage}
        onChangeText={onDosage}
        placeholder="Optional"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Route</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {ROUTES.map((option) => {
          const selected = route === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onRoute(selected ? null : option.value)}
              className={`rounded-full border px-3 py-1.5 ${
                selected
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`text-sm ${
                  selected ? 'text-bloodline-700 font-medium' : 'text-gray-700'
                }`}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Input
        label="Lot number"
        value={lotNumber}
        onChangeText={onLotNumber}
        placeholder="Optional"
      />

      {showWithdrawal ? (
        <View>
          <Text className="text-sm text-gray-600 mb-3">{WITHDRAWAL_VET_HINT}</Text>
          <Input
            label="Meat withdrawal (days)"
            value={meatDays}
            onChangeText={onMeatDays}
            keyboardType="numeric"
            placeholder="Optional"
          />
          {showMilk ? (
            <Input
              label="Milk withdrawal (days)"
              value={milkDays}
              onChangeText={onMilkDays}
              keyboardType="numeric"
              placeholder="Optional"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function parseWithdrawalDays(
  raw: string,
): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  const value = Number.parseInt(trimmed, 10);
  if (Number.isNaN(value) || value < 0) {
    return { ok: false };
  }
  return { ok: true, value };
}
