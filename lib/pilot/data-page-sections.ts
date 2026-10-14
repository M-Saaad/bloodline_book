import {
  BACKUP_B2_REGION,
  POWERSYNC_CLOUD_REGION,
} from '@/lib/config/data-storage';
import { DATA_REGION, OPERATOR_NAME, SUPPORT_EMAIL } from '@/lib/config/support';

export const DATA_PAGE_INTRO =
  'Your herd records belong to you. This page explains what Bloodline Book stores, where it lives, and what we do not do with your information.';

export type DataPageSection = {
  title: string;
  paragraphs: string[];
};

export const DATA_PAGE_SECTIONS: DataPageSection[] = [
  {
    title: 'Who runs Bloodline Book',
    paragraphs: [
      `${OPERATOR_NAME} operates Bloodline Book. Questions about your data: ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    title: 'What you store in the app',
    paragraphs: [
      'You enter goat and farm records: animals, weights, health, breeding, pastures, feed, money, tasks, and document notes. We keep your email address and a secure password hash so you can sign in.',
    ],
  },
  {
    title: 'Where your data is stored',
    paragraphs: [
      `Database (Supabase): ${DATA_REGION}.`,
      `Sync (PowerSync Cloud): ${POWERSYNC_CLOUD_REGION} region — keeps your devices and the database in step when you are online.`,
      `Encrypted backups (Backblaze B2): ${BACKUP_B2_REGION} region — operator-only copies used for disaster recovery.`,
    ],
  },
  {
    title: 'Analytics and crash reports',
    paragraphs: [
      'Bloodline Book does not include third-party analytics, advertising, or crash-reporting SDKs.',
    ],
  },
  {
    title: 'Export and deletion',
    paragraphs: [
      `Email ${SUPPORT_EMAIL} any time for a full export of your farm data or to have your account and herd records deleted.`,
      'Supabase project backups and encrypted off-site backups may still hold copies of deleted data until those backups expire or are overwritten.',
    ],
  },
  {
    title: 'Never sold or shared',
    paragraphs: [
      'We do not sell your herd records or share them with advertisers.',
    ],
  },
];
