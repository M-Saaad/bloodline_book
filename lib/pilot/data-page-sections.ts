import {
  BACKUP_B2_REGION_PLACE,
  POWERSYNC_CLOUD_REGION_PLACE,
} from '@/lib/config/data-storage';
import { SUPPORT_EMAIL } from '@/lib/config/support';

export const DATA_PAGE_TITLE = 'Your herd data';

/** Body copy for the public /data page (exact pilot wording). */
export const DATA_PAGE_PARAGRAPHS: string[] = [
  "It's yours. Everything you enter about your farm and goats belongs to you. We never sell it, rent it, or share it with anyone: no feed companies, no buyers, no other breeders.",
  'Who can see it. You, and only the people you invite to your farm. Saad, who runs Bloodline Book, can reach the database to run backups and fix problems. He only looks at your records if you ask for help.',
  `Where it's kept. On your phone or computer, so the app works without signal. In our database (Supabase, Seoul, South Korea). In our sync service (PowerSync, ${POWERSYNC_CLOUD_REGION_PLACE}). In encrypted weekly backups (Backblaze, ${BACKUP_B2_REGION_PLACE}). Sign-up and password emails are sent through Resend.`,
  `Get a copy any time. Email ${SUPPORT_EMAIL} and we'll send your full herd as a spreadsheet within 3 business days.`,
  "Delete everything. Email us and we'll delete your farm within 7 days. Copies in our backups are gone within 8 weeks.",
  "If Bloodline Book ever shuts down or is sold, we'll email you at least 60 days before and send you a full export first.",
  'No tracking. No ads, no tracking tools, no crash-reporting services.',
  `Questions: ${SUPPORT_EMAIL} · WhatsApp +92 324 2900369`,
  'Bloodline Book is run by Muhammad Saad, Karachi, Pakistan.',
];
