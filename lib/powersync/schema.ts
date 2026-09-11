import { column, Schema, Table } from '@powersync/common';

const farms = new Table(
  {
    name: column.text,
    segment: column.text,
    currency: column.text,
    weight_unit: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { farm_segment: ['segment'] } },
);

const farmMembers = new Table(
  {
    farm_id: column.text,
    user_id: column.text,
    role: column.text,
    equity_share: column.real,
    created_at: column.text,
  },
  { indexes: { member_user: ['user_id'], member_farm: ['farm_id'] } },
);

const breeds = new Table(
  {
    farm_id: column.text,
    name: column.text,
    segment: column.text,
    created_at: column.text,
  },
  { indexes: { breed_farm: ['farm_id'] } },
);

const animals = new Table(
  {
    farm_id: column.text,
    name: column.text,
    tag_number: column.text,
    photo_storage_path: column.text,
    breed_primary_id: column.text,
    breed_percentage: column.real,
    sex: column.text,
    date_of_birth: column.text,
    status: column.text,
    lifecycle_stage: column.text,
    purpose: column.text,
    dam_id: column.text,
    sire_id: column.text,
    sire_external_name: column.text,
    litter_id: column.text,
    registration_body: column.text,
    registration_number: column.text,
    tattoo: column.text,
    purchase_price: column.real,
    sold_price: column.real,
    purchased_from_id: column.text,
    out_date: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      animal_farm: ['farm_id'],
      animal_status: ['farm_id', 'status'],
    },
  },
);

const weighSessions = new Table(
  {
    farm_id: column.text,
    date: column.text,
    weigh_point: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { session_farm: ['farm_id'], session_date: ['date'] } },
);

const weightLogs = new Table(
  {
    farm_id: column.text,
    weigh_session_id: column.text,
    animal_id: column.text,
    weight_value: column.real,
    weight_unit: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      log_animal: ['animal_id'],
      log_session: ['weigh_session_id'],
    },
  },
);

export const AppSchema = new Schema({
  farms,
  farm_members: farmMembers,
  breeds,
  animals,
  weigh_sessions: weighSessions,
  weight_logs: weightLogs,
});

export type Database = (typeof AppSchema)['types'];
