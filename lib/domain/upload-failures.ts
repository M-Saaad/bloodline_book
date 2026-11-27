const TABLE_LABELS: Record<string, string> = {
  farms: 'Farm',
  breeds: 'Breed',
  animals: 'Animal',
  weigh_sessions: 'Weigh session',
  weight_logs: 'Weight',
  transactions: 'Transaction',
  farm_invites: 'Team invite',
  documents: 'Document',
  tasks: 'Task',
  kidding_events: 'Kidding',
  breeding_events: 'Breeding',
  health_records: 'Health record',
  pastures: 'Pasture',
  grazing_records: 'Grazing stay',
  feed_logs: 'Feed log',
};

export function uploadFailureTableLabel(tableName: string): string {
  return TABLE_LABELS[tableName] ?? tableName.replace(/_/g, ' ');
}

export function uploadFailurePlainReason(
  errorCode: string | null,
  errorMessage?: string | null,
): string {
  if (
    errorCode === '23514' &&
    typeof errorMessage === 'string' &&
    /same farm/i.test(errorMessage)
  ) {
    return 'The dam or sire is a goat on another farm.';
  }
  switch (errorCode) {
    case '42501':
      return 'View only: ask the farm owner for manager access.';
    case '23503':
      return 'This record is linked to other records.';
    case '23514':
      return 'The server rejected this change.';
    default:
      return 'This change could not be saved to the server.';
  }
}

/** Short farmer-facing line for a failed upload row. */
export function uploadFailureSummary(input: {
  tableName: string;
  errorCode: string | null;
  errorMessage?: string | null;
}): string {
  const record = uploadFailureTableLabel(input.tableName);
  const reason = uploadFailurePlainReason(input.errorCode, input.errorMessage);
  return `${record}: ${reason}`;
}
