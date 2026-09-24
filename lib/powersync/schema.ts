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
    official_id: column.text,
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
      animal_farm_tag: ['farm_id', 'tag_number'],
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
    updated_at: column.text,
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
    updated_at: column.text,
  },
  {
    indexes: {
      log_animal: ['animal_id'],
      log_session: ['weigh_session_id'],
    },
  },
);

const transactions = new Table(
  {
    farm_id: column.text,
    date: column.text,
    amount: column.real,
    kind: column.text,
    category: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { transaction_farm: ['farm_id'], transaction_date: ['date'] } },
);

const farmInvites = new Table(
  {
    farm_id: column.text,
    email: column.text,
    role: column.text,
    status: column.text,
    created_at: column.text,
  },
  { indexes: { invite_farm: ['farm_id'] } },
);

const documents = new Table(
  {
    farm_id: column.text,
    animal_id: column.text,
    type: column.text,
    title: column.text,
    storage_path: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { document_farm: ['farm_id'] } },
);

const tasks = new Table(
  {
    farm_id: column.text,
    title: column.text,
    due_date: column.text,
    priority: column.text,
    assigned_to: column.text,
    source: column.text,
    source_id: column.text,
    completed: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { task_farm: ['farm_id'], task_due: ['due_date'] } },
);

const kiddingEvents = new Table(
  {
    farm_id: column.text,
    dam_id: column.text,
    sire_id: column.text,
    sire_external_name: column.text,
    kid_date: column.text,
    kids_born: column.integer,
    kids_surviving: column.integer,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      kidding_farm: ['farm_id'],
      kidding_dam: ['dam_id'],
    },
  },
);

const breedingEvents = new Table(
  {
    farm_id: column.text,
    dam_id: column.text,
    sire_id: column.text,
    sire_external_name: column.text,
    bred_date: column.text,
    due_date: column.text,
    status: column.text,
    kidding_event_id: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      breeding_farm: ['farm_id'],
      breeding_dam: ['dam_id'],
    },
  },
);

const healthRecords = new Table(
  {
    farm_id: column.text,
    animal_id: column.text,
    date: column.text,
    kind: column.text,
    famacha_score: column.integer,
    product_name: column.text,
    dosage: column.text,
    withdrawal_days: column.integer,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      health_farm: ['farm_id'],
      health_animal: ['animal_id'],
    },
  },
);

const pastures = new Table(
  {
    farm_id: column.text,
    name: column.text,
    acres: column.real,
    forage_type: column.text,
    status: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { pasture_farm: ['farm_id'] } },
);

const grazingRecords = new Table(
  {
    farm_id: column.text,
    pasture_id: column.text,
    animal_id: column.text,
    start_date: column.text,
    end_date: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      grazing_farm: ['farm_id'],
      grazing_pasture: ['pasture_id'],
      grazing_animal: ['animal_id'],
    },
  },
);

const feedLogs = new Table(
  {
    farm_id: column.text,
    date: column.text,
    feed_type: column.text,
    quantity: column.real,
    unit: column.text,
    pasture_id: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { feed_farm: ['farm_id'], feed_date: ['date'] } },
);

const uploadFailures = new Table(
  {
    table_name: column.text,
    op: column.text,
    row_id: column.text,
    op_data: column.text,
    error_code: column.text,
    error_message: column.text,
    applied_before_failure: column.integer,
    created_at: column.text,
  },
  { localOnly: true, indexes: { upload_failure_created: ['created_at'] } },
);

export const AppSchema = new Schema({
  farms,
  farm_members: farmMembers,
  breeds,
  animals,
  weigh_sessions: weighSessions,
  weight_logs: weightLogs,
  transactions,
  farm_invites: farmInvites,
  documents,
  tasks,
  kidding_events: kiddingEvents,
  breeding_events: breedingEvents,
  health_records: healthRecords,
  pastures,
  grazing_records: grazingRecords,
  feed_logs: feedLogs,
  upload_failures: uploadFailures,
});

export type Database = (typeof AppSchema)['types'];
