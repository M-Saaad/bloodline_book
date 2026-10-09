import type { Animal } from '@/lib/types/animals';

/** The columns the pedigree needs from `animals`. */
export type PedigreeAnimal = Pick<
  Animal,
  | 'id'
  | 'name'
  | 'tagNumber'
  | 'registrationNumber'
  | 'sex'
  | 'damId'
  | 'sireId'
  | 'damExternalName'
  | 'sireExternalName'
>;

/**
 * One box in the tree.
 * - herd: a goat on this farm (tappable).
 * - outside: only a typed name (bought-in or off-farm parent); ends the branch.
 * - unknown: nothing recorded; ends the branch.
 */
export type PedigreeNode =
  | {
      kind: 'herd';
      id: string;
      name: string | null;
      tagNumber: string | null;
      registrationNumber: string | null;
    }
  | { kind: 'outside'; name: string }
  | { kind: 'unknown' };

export interface PedigreeBranch {
  /** Path from the subject: 'S' = sire, 'D' = dam, 'SD' = sire's dam, and so on. */
  path: string;
  role: 'sire' | 'dam';
  node: PedigreeNode;
  sire: PedigreeBranch | null;
  dam: PedigreeBranch | null;
}

export interface Pedigree {
  sire: PedigreeBranch;
  dam: PedigreeBranch;
  /** Number of ancestor boxes with something recorded (herd or outside). */
  knownCount: number;
}

/** Ancestor generations on the full pedigree screen (plus the goat itself = 5). */
export const FULL_PEDIGREE_GENERATIONS = 4;
/** Ancestor generations on the goat page card. */
export const CARD_PEDIGREE_GENERATIONS = 2;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Build the ancestor tree for one goat from the farm's own records.
 * Walks `sire_id` / `dam_id`; an outside name or a missing parent ends a branch.
 * A parent id that loops back to a goat already on this branch (bad data) is
 * shown as unknown, so the screen can never recurse forever.
 */
export function buildPedigree(
  subjectId: string,
  herd: PedigreeAnimal[],
  generations: number,
): Pedigree | null {
  const byId = new Map(herd.map((animal) => [animal.id, animal]));
  const subject = byId.get(subjectId);
  if (!subject || generations < 1) {
    return null;
  }

  let knownCount = 0;

  const branch = (
    child: PedigreeAnimal,
    role: 'sire' | 'dam',
    path: string,
    depth: number,
    lineage: Set<string>,
  ): PedigreeBranch => {
    const parentId = role === 'sire' ? child.sireId : child.damId;
    const externalName = clean(
      role === 'sire' ? child.sireExternalName : child.damExternalName,
    );
    const parent = parentId ? byId.get(parentId) : undefined;

    if (parent && !lineage.has(parent.id)) {
      knownCount += 1;
      const next = new Set(lineage).add(parent.id);
      const canGrow = depth < generations;
      return {
        path,
        role,
        node: {
          kind: 'herd',
          id: parent.id,
          name: clean(parent.name),
          tagNumber: clean(parent.tagNumber),
          registrationNumber: clean(parent.registrationNumber),
        },
        sire: canGrow ? branch(parent, 'sire', `${path}S`, depth + 1, next) : null,
        dam: canGrow ? branch(parent, 'dam', `${path}D`, depth + 1, next) : null,
      };
    }

    if (externalName) {
      knownCount += 1;
      return { path, role, node: { kind: 'outside', name: externalName }, sire: null, dam: null };
    }

    return { path, role, node: { kind: 'unknown' }, sire: null, dam: null };
  };

  const lineage = new Set([subject.id]);
  const sire = branch(subject, 'sire', 'S', 1, lineage);
  const dam = branch(subject, 'dam', 'D', 1, lineage);
  return { sire, dam, knownCount };
}

/** Plain-English name for a pedigree position, e.g. 'SD' → "Sire's dam". */
export function pedigreePositionLabel(path: string): string {
  if (!path) {
    return '';
  }
  const words = path.split('').map((step) => (step === 'S' ? 'sire' : 'dam'));
  const text = words.join("'s ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Map a PowerSync `animals` row (snake_case) to the fields the pedigree uses. */
export function pedigreeAnimalFromRow(row: Record<string, unknown>): PedigreeAnimal {
  const text = (value: unknown) => (value != null && value !== '' ? String(value) : null);
  return {
    id: String(row.id),
    name: text(row.name),
    tagNumber: text(row.tag_number),
    registrationNumber: text(row.registration_number),
    sex: row.sex === 'male' ? 'male' : 'female',
    damId: text(row.dam_id),
    sireId: text(row.sire_id),
    damExternalName: text(row.dam_external_name),
    sireExternalName: text(row.sire_external_name),
  };
}

export const PEDIGREE_HERD_SQL = `SELECT id, name, tag_number, registration_number, sex,
       dam_id, sire_id, dam_external_name, sire_external_name
  FROM animals WHERE farm_id = ?`;
