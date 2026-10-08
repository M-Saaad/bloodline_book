import { Pressable, Text, TextInput, View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import { formatDisplayDate } from '@/lib/dates';
import {
  FAMACHA_SCORE_3_HINT,
  showsMilkWithdrawal,
  withdrawalClearDate,
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
  /** Date of the record, used to show when the animal is safe to sell. */
  recordDate?: string;
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

function stepDays(raw: string, delta: number): string {
  const current = Number.parseInt(raw.trim(), 10);
  const base = Number.isNaN(current) ? 0 : current;
  if (delta < 0 && raw.trim() === '') {
    return raw;
  }
  return String(Math.max(0, base + delta));
}

function DaysStepper({
  label,
  value,
  onChange,
  fewerLabel,
  moreLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fewerLabel: string;
  moreLabel: string;
}) {
  return (
    <View className="flex-row items-center justify-between mt-2">
      <Text className="text-[17px] font-extrabold text-[#6b3a00] flex-1 pr-2">{label}</Text>
      <View className="flex-row items-center gap-2.5">
        <Pressable
          onPress={() => onChange(stepDays(value, -1))}
          accessibilityRole="button"
          accessibilityLabel={fewerLabel}
          className="w-12 h-12 rounded-full bg-white border border-[#e5c77a] items-center justify-center">
          <Text className="text-[26px] font-bold text-[#6b3a00]">−</Text>
        </Pressable>
        <View className="flex-row items-baseline justify-center min-w-[84px]">
          <TextInput
            value={value}
            onChangeText={onChange}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#8a7b75"
            accessibilityLabel={`${label} (days)`}
            className="text-2xl font-extrabold text-[#6b3a00] text-center min-w-[36px] p-0"
          />
          <Text className="text-2xl font-extrabold text-[#6b3a00]"> days</Text>
        </View>
        <Pressable
          onPress={() => onChange(stepDays(value, 1))}
          accessibilityRole="button"
          accessibilityLabel={moreLabel}
          className="w-12 h-12 rounded-full bg-white border border-[#e5c77a] items-center justify-center">
          <Text className="text-[26px] font-bold text-[#6b3a00]">＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function TreatmentFields({
  segment,
  showWithdrawal,
  famachaScore,
  recordDate,
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
  const meatParsed = Number.parseInt(meatDays.trim(), 10);
  const clearDate =
    recordDate && !Number.isNaN(meatParsed)
      ? withdrawalClearDate(recordDate, meatParsed)
      : null;

  return (
    <View>
      {famachaScore === 3 ? (
        <View className="mb-4">
          <Banner
            tone="amber"
            title="Score 3: keep an eye on her"
            message={FAMACHA_SCORE_3_HINT}
          />
        </View>
      ) : null}

      <Input
        label="Product / medication"
        value={productName}
        onChangeText={onProductName}
        placeholder="Optional"
      />
      {remembered.length > 0 ? (
        <View className="mb-4 -mt-2">
          <ChipRow>
            {remembered.map((product) => (
              <Chip
                key={product.productName}
                label={product.productName}
                selected={
                  productName.trim().toLowerCase() ===
                  product.productName.toLowerCase()
                }
                onPress={() => onPickProduct(product)}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      <Input
        label="Dosage"
        value={dosage}
        onChangeText={onDosage}
        placeholder="Optional"
      />

      <FieldLabel>Route</FieldLabel>
      <View className="mb-4">
        <ChipRow>
          {ROUTES.map((option) => {
            const selected = route === option.value;
            return (
              <Chip
                key={option.value}
                label={option.label}
                selected={selected}
                onPress={() => onRoute(selected ? null : option.value)}
              />
            );
          })}
        </ChipRow>
      </View>

      <Input
        label="Lot number"
        value={lotNumber}
        onChangeText={onLotNumber}
        placeholder="Optional"
      />

      {showWithdrawal ? (
        <View className="bg-[#fff1cc] rounded-[20px] px-4 py-3.5 mb-4">
          <DaysStepper
            label="Meat withdrawal"
            value={meatDays}
            onChange={onMeatDays}
            fewerLabel="Fewer meat withdrawal days"
            moreLabel="More meat withdrawal days"
          />
          {showMilk ? (
            <View className="mt-2">
              <DaysStepper
                label="Milk withdrawal"
                value={milkDays}
                onChange={onMilkDays}
                fewerLabel="Fewer milk withdrawal days"
                moreLabel="More milk withdrawal days"
              />
            </View>
          ) : null}
          {clearDate ? (
            <Text className="text-[15px] leading-[21px] text-[#6b3a00] mt-2.5">
              Safe to sell from{' '}
              <Text className="font-extrabold">{formatDisplayDate(clearDate)}</Text>. This
              is a reminder only.
            </Text>
          ) : null}
          <Text className="text-[15px] leading-[21px] text-[#6b3a00] mt-2.5">
            {WITHDRAWAL_VET_HINT}
          </Text>
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
