import { Badge } from '@/components/ui/Badge';
import type { PastureStatus } from '@/lib/types/land';

const LABELS: Record<PastureStatus, string> = {
  grazing: 'Grazing',
  resting: 'Resting',
  hay: 'Hay',
  overgrazed: 'Overgrazed',
};

const TONES: Record<PastureStatus, 'success' | 'default' | 'info' | 'danger'> = {
  grazing: 'success',
  resting: 'default',
  hay: 'info',
  overgrazed: 'danger',
};

export function pastureStatusLabel(status: PastureStatus): string {
  return LABELS[status];
}

/** Symbol + word + color. Overgrazed is black with a warning symbol. */
export function PastureStatusBadge({ status }: { status: PastureStatus }) {
  return <Badge label={LABELS[status]} tone={TONES[status]} />;
}
