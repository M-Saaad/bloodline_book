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

export function uploadFailurePlainReason(errorCode: string | null): string {
  switch (errorCode) {
    case '42501':
      return "Your role on this farm can't make this change.";
    case '23503':
      return 'This record is linked to other records.';
    default:
      return 'This change could not be saved to the server.';
  }
}
