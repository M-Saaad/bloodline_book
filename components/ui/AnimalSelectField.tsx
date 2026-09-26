import { AnimalPickerField } from '@/components/ui/AnimalPickerField';
import type { AnimalPickerSingleProps } from '@/components/ui/AnimalPickerField';

export function AnimalSelectField(
  props: Omit<AnimalPickerSingleProps, 'mode'>,
) {
  return <AnimalPickerField mode="single" {...props} />;
}
