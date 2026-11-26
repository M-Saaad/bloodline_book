import { useQuery, useStatus } from '@powersync/react';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { formatDisplayDate } from '@/lib/dates';
import { changeAnimalTag } from '@/lib/db/tag-history';
import {
  normalizeTagValue,
  sortTagHistory,
  TAG_KINDS,
  tagKindLabel,
  type TagChangeAction,
  type TagKind,
} from '@/lib/domain/tag-history';
import type { Animal } from '@/lib/types/animals';
import { Text } from '@/components/ui/Text';

export type TagHistoryRow = {
  id: string;
  kind: TagKind;
  value: string;
  startedOn: string | null;
  endedOn: string | null;
  note: string | null;
  createdAt: string;
};

/** Temporary. Remove after the tag-history sync check is confirmed. */
function TagHistorySyncDebug() {
  const status = useStatus();
  const { data: meta } = useQuery<{
    history_table: number;
    history_view: number;
    history_internal: number;
    animal_count: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM sqlite_master WHERE name = 'tag_history' AND type = 'table') AS history_table,
       (SELECT COUNT(*) FROM sqlite_master WHERE name = 'tag_history' AND type = 'view') AS history_view,
       (SELECT COUNT(*) FROM sqlite_master WHERE name = 'ps_data__tag_history') AS history_internal,
       (SELECT COUNT(*) FROM animals) AS animal_count`,
  );
  const { data: history, error: historyError } = useQuery<{ c: number }>(
    'SELECT COUNT(*) AS c FROM tag_history',
  );
  const row = meta?.[0];
  const historyCount = historyError
    ? `error ${historyError.message}`
    : String(history?.[0]?.c ?? '…');
  const last = status.lastSyncedAt ? status.lastSyncedAt.toISOString() : 'never';
  const downloadError = status.downloadError?.message;

  return (
    <Text className="text-[13px] leading-5 text-gray-500 mb-3">
      {`Debug: tag_history ${historyCount} (sqlite table ${row?.history_table ?? '…'}, view ${row?.history_view ?? '…'}, internal ${row?.history_internal ?? '…'}), animals ${row?.animal_count ?? '…'}, connected ${status.connected ? 'yes' : 'no'}, synced ${status.hasSynced === true ? 'yes' : status.hasSynced === false ? 'no' : 'unknown'}, downloading ${status.downloading ? 'yes' : 'no'}, last ${last}${downloadError ? `, download error ${downloadError}` : ''}`}
    </Text>
  );
}

function currentValue(animal: Animal, kind: TagKind): string | null {
  switch (kind) {
    case 'farm_tag':
      return normalizeTagValue(animal.tagNumber);
    case 'official_id':
      return normalizeTagValue(animal.officialId);
    case 'tattoo':
      return normalizeTagValue(animal.tattoo);
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function displayDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  return formatDisplayDate(iso.slice(0, 10));
}

function whenLabel(row: TagHistoryRow): string {
  const started = displayDate(row.startedOn);
  const ended = displayDate(row.endedOn);
  if (!row.endedOn) {
    return started ? `Current · since ${started}` : 'Current';
  }
  if (started && ended) {
    return `${started} to ${ended}`;
  }
  return ended ? `Until ${ended}` : 'Past';
}

export function TagHistoryCard({
  animal,
  rows,
}: {
  animal: Animal;
  rows: TagHistoryRow[];
}) {
  const [action, setAction] = useState<TagChangeAction | null>(null);
  const history = sortTagHistory(rows);
  const missing = TAG_KINDS.filter((kind) => !currentValue(animal, kind));
  const present = TAG_KINDS.filter((kind) => currentValue(animal, kind));

  return (
    <Card>
      <Text className="text-xl font-extrabold text-ink mb-3">Tags</Text>
      <TagHistorySyncDebug />
      {history.length === 0 ? (
        <Text className="text-gray-500 mb-3">No tags recorded yet.</Text>
      ) : (
        <View className="gap-3 mb-3">
          {history.map((row) => (
            <View key={row.id}>
              <Text className="text-[17px] text-ink">
                {tagKindLabel(row.kind)} · {row.value}
              </Text>
              <Text className="text-[15px] text-gray-500">{whenLabel(row)}</Text>
              {row.note?.trim() ? (
                <Text className="text-[15px] text-gray-500">{row.note.trim()}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
      <FarmWriteGate>
        <View className="gap-2">
          {missing.length > 0 ? (
            <Button title="Add tag" variant="outline" onPress={() => setAction('add')} />
          ) : null}
          {present.length > 0 ? (
            <Button
              title="Replace tag"
              variant="outline"
              onPress={() => setAction('replace')}
            />
          ) : null}
          {present.length > 0 ? (
            <Button
              title="Remove tag"
              variant="secondary"
              onPress={() => setAction('clear')}
            />
          ) : null}
        </View>
      </FarmWriteGate>
      <TagActionSheet
        animal={animal}
        action={action}
        onClose={() => setAction(null)}
      />
    </Card>
  );
}

function TagActionSheet({
  animal,
  action,
  onClose,
}: {
  animal: Animal;
  action: TagChangeAction | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const eligible = TAG_KINDS.filter((kind) => {
    const current = currentValue(animal, kind);
    return action === 'add' ? !current : Boolean(current);
  });
  const [kind, setKind] = useState<TagKind | null>(null);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = kind && eligible.includes(kind) ? kind : (eligible[0] ?? null);
  const current = selected ? currentValue(animal, selected) : null;

  useEffect(() => {
    setKind(null);
    setValue('');
    setNote('');
    setError('');
    setSaving(false);
  }, [action]);

  async function save() {
    if (!action || !selected) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await changeAnimalTag(animal.id, {
        action,
        kind: selected,
        value,
        note,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update the tag.');
      setSaving(false);
    }
  }

  const title =
    action === 'add' ? 'Add tag' : action === 'replace' ? 'Replace tag' : 'Remove tag';

  return (
    <Modal visible={action != null} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable
          className="bg-paper rounded-t-[28px] px-5 pt-5"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          onPress={() => undefined}>
          <Text className="text-2xl font-extrabold text-ink mb-3">{title}</Text>
          <TagHistorySyncDebug />
          {error ? <FormMessage message={error} /> : null}
          <Text className="text-base font-bold text-ink mb-2">Kind</Text>
          <View className="mb-4">
            <ChipRow>
              {eligible.map((option) => (
                <Chip
                  key={option}
                  label={tagKindLabel(option)}
                  selected={selected === option}
                  onPress={() => setKind(option)}
                />
              ))}
            </ChipRow>
          </View>
          {current ? (
            <Text className="text-[15px] text-gray-500 mb-3">
              {action === 'clear'
                ? `Remove ${tagKindLabel(selected ?? 'farm_tag').toLowerCase()} ${current}. It stays in the history.`
                : `Current: ${current}`}
            </Text>
          ) : null}
          {action !== 'clear' ? (
            <Input
              label="New value"
              value={value}
              onChangeText={setValue}
              autoCapitalize="characters"
              placeholder="24A"
            />
          ) : null}
          <Input
            label="Note"
            value={note}
            onChangeText={setNote}
            optional
            placeholder="Lost in the pasture"
          />
          <Button
            title={saving ? 'Saving…' : title}
            onPress={() => void save()}
            disabled={saving || !selected}
          />
          <View className="h-2" />
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
