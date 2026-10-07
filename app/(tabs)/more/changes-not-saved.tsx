import { useQuery } from '@powersync/react';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  uploadFailurePlainReason,
  uploadFailureSummary,
  uploadFailureTableLabel,
} from '@/lib/domain/upload-failures';
import { dismissUploadFailure } from '@/lib/powersync/upload-failures';
import { powersync } from '@/lib/powersync/system';

interface UploadFailureRow {
  id: string;
  table_name: string;
  op: string;
  row_id: string;
  op_data: string;
  error_code: string | null;
  error_message: string | null;
  applied_before_failure: number | null;
  created_at: string;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

async function copyDetails(row: UploadFailureRow): Promise<void> {
  const payload = {
    record: uploadFailureTableLabel(row.table_name),
    when: row.created_at,
    reason: uploadFailurePlainReason(row.error_code),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    operation: row.op,
    rowId: row.row_id,
    data: row.op_data,
    appliedBeforeFailure: row.applied_before_failure === 1,
  };
  const text = JSON.stringify(payload, null, 2);

  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  await Share.share({ message: text });
}

function FailureCard({
  row,
  onDismissed,
}: {
  row: UploadFailureRow;
  onDismissed: () => void;
}) {
  const [technicalOpen, setTechnicalOpen] = useState(false);

  return (
    <Card>
      <Text className="text-lg font-semibold text-gray-900 mb-1">
        {uploadFailureTableLabel(row.table_name)}
      </Text>
      <Text className="text-gray-600 text-sm mb-2">
        {formatWhen(row.created_at)}
      </Text>
      <Text className="text-gray-900 mb-3">
        {uploadFailureSummary({
          tableName: row.table_name,
          errorCode: row.error_code,
        })}
      </Text>

      <Pressable
        onPress={() => setTechnicalOpen((open) => !open)}
        className="min-h-[44px] justify-center mb-2">
        <Text className="text-bloodline-700 font-semibold">
          {technicalOpen ? 'Hide technical details' : 'Technical details'}
        </Text>
      </Pressable>
      {technicalOpen ? (
        <Text className="text-xs text-gray-500 mb-4 font-mono">{row.op_data}</Text>
      ) : null}

      <View className="flex-row gap-2">
        <Button
          title="Copy details"
          variant="outline"
          onPress={() => copyDetails(row)}
          className="flex-1"
        />
        <Button
          title="Dismiss"
          variant="outline"
          onPress={async () => {
            await dismissUploadFailure(row.id);
            onDismissed();
          }}
          className="flex-1"
        />
      </View>
    </Card>
  );
}

export default function ChangesNotSavedScreen() {
  const { data: rows, refresh } = useQuery<UploadFailureRow>(
    `SELECT * FROM upload_failures ORDER BY created_at DESC`,
  );
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  const failures = useMemo(() => rows ?? [], [rows]);

  const loadQueue = useCallback(async () => {
    const stats = await powersync.getUploadQueueStats();
    setPendingQueueCount(stats.count);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadQueue();
    }, [loadQueue]),
  );

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 gap-4">
      <Text className="text-gray-600 text-sm">
        These changes were made on this device but the server rejected them. Your
        other records are still saved locally and online.
      </Text>

      {pendingQueueCount > 0 && failures.length === 0 ? (
        <Card>
          <Text className="text-gray-700">
            {pendingQueueCount}{' '}
            {pendingQueueCount === 1 ? 'change is' : 'changes are'} saved on this
            device and will upload when you are back online.
          </Text>
        </Card>
      ) : null}

      {failures.length === 0 ? (
        <Card>
          <Text className="text-gray-700">
            {pendingQueueCount > 0
              ? 'No rejected changes right now.'
              : 'Nothing here — all changes are saved.'}
          </Text>
        </Card>
      ) : (
        failures.map((row) => (
          <FailureCard
            key={row.id}
            row={row}
            onDismissed={async () => {
              await refresh?.();
              await loadQueue();
            }}
          />
        ))
      )}

      <Button title="Back" variant="outline" onPress={() => router.back()} />
    </ScrollView>
  );
}
