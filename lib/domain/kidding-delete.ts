import type { KiddingKidSummary } from '@/lib/db/breeding';

export function kiddingDeleteKidsPrompt(kids: KiddingKidSummary[]): string {
  if (kids.length === 0) {
    return '';
  }

  const withRecords = kids.filter((kid) => kid.hasWeights || kid.hasHealth);
  let message = `Also delete the ${kids.length} kid${kids.length === 1 ? '' : 's'} registered from this kidding?`;

  if (withRecords.length > 0) {
    const names = withRecords
      .map((kid) => kid.name ?? kid.tagNumber ?? 'Unnamed kid')
      .join(', ');
    message += ` ${names} already have weights or health records.`;
  }

  return message;
}
