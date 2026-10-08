import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { todayIso } from '@/lib/dates';
import type { Animal } from '@/lib/types/animals';
import { isBreedingAgeDoe, type PickerBlock } from '@/lib/ui/animal-picker';

type AnimalParentFieldsProps = {
  damAnimals: Animal[];
  sireAnimals: Animal[];
  damId: string | null;
  onDamIdChange: (value: string | null) => void;
  damExternalName: string;
  onDamExternalNameChange: (value: string) => void;
  sireId: string | null;
  onSireIdChange: (value: string | null) => void;
  sireExternalName: string;
  onSireExternalNameChange: (value: string) => void;
  exclude?: PickerBlock[];
  section?: 'dam' | 'sire' | 'all';
};

export function AnimalParentFields({
  damAnimals,
  sireAnimals,
  damId,
  onDamIdChange,
  damExternalName,
  onDamExternalNameChange,
  sireId,
  onSireIdChange,
  sireExternalName,
  onSireExternalNameChange,
  exclude = [],
  section = 'all',
}: AnimalParentFieldsProps) {
  const today = todayIso();

  return (
    <>
      {section !== 'sire' ? (
        <AnimalSelectField
          label="Dam"
          animals={damAnimals}
          value={damId}
          onChange={onDamIdChange}
          externalLabel={damExternalName}
          onExternalLabelChange={(label) =>
            onDamExternalNameChange(label ?? '')
          }
          allowClear
          allowUnknown
          allowOutside
          outsideSex="female"
          exclude={exclude}
          quickChips={[
            {
              id: 'breeding-age',
              label: 'Breeding age',
              match: (animal) => isBreedingAgeDoe(animal, today),
            },
          ]}
          emptyMessage="No does on this farm yet. You can add one who is not in this herd."
        />
      ) : null}
      {section !== 'dam' ? (
        <AnimalSelectField
          label="Sire"
          animals={sireAnimals}
          value={sireId}
          onChange={onSireIdChange}
          externalLabel={sireExternalName}
          onExternalLabelChange={(label) =>
            onSireExternalNameChange(label ?? '')
          }
          allowClear
          allowUnknown
          allowOutside
          outsideSex="male"
          exclude={exclude}
          emptyMessage="No bucks on this farm yet. You can add one who is not in this herd."
        />
      ) : null}
    </>
  );
}
