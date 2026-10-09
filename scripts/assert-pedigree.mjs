import assert from 'node:assert/strict';

import {
  buildPedigree,
  pedigreeAnimalFromRow,
  pedigreePositionLabel,
} from '../lib/domain/pedigree.ts';

function goat(id, partial = {}) {
  return {
    id,
    name: partial.name ?? id,
    tagNumber: partial.tagNumber ?? null,
    registrationNumber: partial.registrationNumber ?? null,
    sex: partial.sex ?? 'female',
    damId: partial.damId ?? null,
    sireId: partial.sireId ?? null,
    damExternalName: partial.damExternalName ?? null,
    sireExternalName: partial.sireExternalName ?? null,
  };
}

// Three generations in the herd: kid ← (buck, doe) ← (granddam, outside grandsire).
const herd = [
  goat('kid', { sireId: 'buck', damId: 'doe' }),
  goat('buck', { sex: 'male', registrationNumber: 'KR62193194', damId: 'granddam' }),
  goat('doe', { sireExternalName: '  Thunder  ' }),
  goat('granddam'),
];

const tree = buildPedigree('kid', herd, 4);
assert.ok(tree);
assert.equal(tree.sire.node.kind, 'herd');
assert.equal(tree.sire.node.id, 'buck');
assert.equal(tree.sire.node.registrationNumber, 'KR62193194');
assert.equal(tree.dam.node.id, 'doe');
// Buck's dam is in the herd, his sire is unknown.
assert.equal(tree.sire.dam.node.kind, 'herd');
assert.equal(tree.sire.dam.path, 'SD');
assert.equal(tree.sire.sire.node.kind, 'unknown');
// Doe's sire is an outside name (trimmed) and ends the line.
assert.deepEqual(tree.dam.sire.node, { kind: 'outside', name: 'Thunder' });
assert.equal(tree.dam.sire.sire, null);
assert.equal(tree.dam.dam.node.kind, 'unknown');
// Granddam's parents are unknown boxes; they end there.
assert.equal(tree.sire.dam.sire.node.kind, 'unknown');
assert.equal(tree.sire.dam.sire.sire, null);
// buck, doe, granddam, Thunder.
assert.equal(tree.knownCount, 4);

// Depth limit: with 1 generation, parents have no children.
const shallow = buildPedigree('kid', herd, 1);
assert.equal(shallow.sire.sire, null);
assert.equal(shallow.knownCount, 2);

// No parents at all.
const orphan = buildPedigree('granddam', herd, 4);
assert.equal(orphan.knownCount, 0);
assert.equal(orphan.sire.node.kind, 'unknown');

// Unknown goat.
assert.equal(buildPedigree('missing', herd, 4), null);

// A goat pointing to a missing parent id falls back to its outside name.
const dangling = buildPedigree('x', [goat('x', { sireId: 'gone', sireExternalName: 'Old buck' })], 2);
assert.deepEqual(dangling.sire.node, { kind: 'outside', name: 'Old buck' });

// Bad data that loops (a is b's dam, b is a's dam) must not recurse forever.
const loop = buildPedigree('a', [goat('a', { damId: 'b' }), goat('b', { damId: 'a' })], 10);
assert.equal(loop.dam.node.id, 'b');
assert.equal(loop.dam.dam.node.kind, 'unknown');

// Labels.
assert.equal(pedigreePositionLabel('S'), 'Sire');
assert.equal(pedigreePositionLabel('SD'), "Sire's dam");
assert.equal(pedigreePositionLabel('DSS'), "Dam's sire's sire");

// Row mapping.
assert.deepEqual(
  pedigreeAnimalFromRow({
    id: 'r',
    name: '',
    tag_number: 12,
    registration_number: null,
    sex: 'male',
    dam_id: 'd',
    sire_id: null,
    dam_external_name: null,
    sire_external_name: 'Outside',
  }),
  {
    id: 'r',
    name: null,
    tagNumber: '12',
    registrationNumber: null,
    sex: 'male',
    damId: 'd',
    sireId: null,
    damExternalName: null,
    sireExternalName: 'Outside',
  },
);

console.log('assert-pedigree: ok');
