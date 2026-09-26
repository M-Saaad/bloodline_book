import {
  AnimalPickerField,
  type AnimalPickerMultiProps,
} from '@/components/ui/AnimalPickerField';

export function AnimalMultiSelectField(
  props: Omit<AnimalPickerMultiProps, 'mode'>,
) {
  return <AnimalPickerField mode="multi" {...props} />;
}
