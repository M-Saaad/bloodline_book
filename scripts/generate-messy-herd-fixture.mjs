#!/usr/bin/env node
/**
 * Writes scripts/fixtures/messy-herd-import.xlsx — a realistic messy meat-goat herd sheet.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const OUT_PATH = join(OUT_DIR, 'messy-herd-import.xlsx');

/** @type {Record<string, unknown>[]} */
const rows = [
  {
    'Goat Name': 'Big Mama',
    'Ear Tag': '101',
    Sex: 'Doe',
    'Birth Date': '3/15/2019',
    Breed: 'Boer',
    '%': '100%',
    Dam: 'Star 88',
    Sire: 'Outside Buck Rex',
    'Reg #': 'ABGA12345',
    Registry: 'ABGA',
    Tattoo: 'BM19',
    Notes: 'Foundation doe',
  },
  {
    'Goat Name': 'Rex Jr',
    'Ear Tag': 'B01',
    Sex: 'Buck',
    'Birth Date': '01/10/2018',
    Breed: 'boer',
    '%': 75,
    Dam: 'Big Mama',
    Sire: 'Thunder',
    'Reg #': '',
    Registry: '',
    Tattoo: '',
    Notes: '',
  },
  {
    'Goat Name': 'Star 88',
    'Ear Tag': '088',
    Sex: 'F',
    'Birth Date': 43465,
    Breed: 'Kiko',
    '%': '',
    Dam: '',
    Sire: 'Old Timer',
    'Reg #': '',
    Registry: 'USBGA',
    Tattoo: 'S88',
    Notes: 'Purchased 2020',
  },
  {
    'Goat Name': 'Cinnamon',
    'Ear Tag': '102',
    Sex: 'Doe',
    'Birth Date': '4/2/21',
    Breed: 'Spanish',
    '%': '50%',
    Dam: 'Big Mama',
    Sire: 'B01',
    'Reg #': '',
    Registry: '',
    Tattoo: '',
    Notes: '',
  },
  {
    'Goat Name': 'Pepper',
    'Ear Tag': '103',
    Sex: 'Female',
    'Birth Date': '5/18/2022',
    Breed: 'Boer',
    '%': '',
    Dam: '102',
    Sire: 'Rex Jr',
    'Reg #': '',
    Registry: '',
    Tattoo: '',
    Notes: 'Twin',
  },
  {
    'Goat Name': 'Salt',
    'Ear Tag': '104',
    Sex: 'Doe',
    'Birth Date': '5/18/22',
    Breed: 'Boer',
    '%': '',
    Dam: 'Cinnamon',
    Sire: 'B01',
    'Reg #': '',
    Registry: '',
    Tattoo: '',
    Notes: 'Twin',
  },
  {
    'Goat Name': 'Waldo',
    'Ear Tag': 'W1',
    Sex: 'Wether',
    'Birth Date': '6/1/2023',
    Breed: 'Boer',
    '%': '',
    Dam: 'Big Mama',
    Sire: 'Outside Buck Rex',
    'Reg #': '',
    Registry: '',
    Tattoo: '',
    Notes: 'Market wether',
  },
  {
    'Goat Name': 'Ace',
    'Ear Tag': 'B02',
    Sex: 'M',
    'Birth Date': '2/14/2020',
    Breed: 'Savanna',
    '%': '100',
    Dam: 'Star 88',
    Sire: 'Thunder',
    'Reg #': 'KR62193194',
    Registry: 'ABGA',
    Tattoo: 'AC20',
    Notes: 'Herd sire',
  },
  {
    'Goat Name': 'Dottie',
    'Ear Tag': '105',
    Sex: 'Doe',
    'Birth Date': '2020-08-01',
    Breed: 'Kiko',
    '%': '',
    Dam: '',
    Sire: '',
    'Reg #': '',
    Registry: '',
    Tattoo: '',
    Notes: 'Bought at sale',
  },
  {
    'Goat Name': 'Mocha',
    'Ear Tag': '106',
    Sex: 'Doe',
    'Birth Date': '9/9/19',
    Breed: 'Boer',
    '%': '94%',
    Dam: 'Dottie',
    Sire: 'Ace',
    'Reg #': '',
    Registry: '',
    Tattoo: '',
    Notes: '',
  },
];

// Pad to ~40 goats with variations
const extraNames = [
  'Honey', 'Ginger', 'Nutmeg', 'Clove', 'Basil', 'Sage', 'Rosemary', 'Thyme',
  'Maple', 'Birch', 'Cedar', 'Pine', 'Oak', 'Willow', 'Aspen', 'Elm',
  'Ruby', 'Pearl', 'Jade', 'Amber', 'Onyx', 'Copper', 'Silver', 'Gold',
  'Patch', 'Spot', 'Blaze', 'Star', 'Moon', 'Sun', 'Rain', 'Storm',
  'Biscuit', 'Cookie', 'Muffin', 'Brownie',
];
let tag = 200;
for (const name of extraNames) {
  if (rows.length >= 40) {
    break;
  }
  const year = 2018 + (tag % 6);
  const month = (tag % 12) + 1;
  const day = (tag % 27) + 1;
  const formats = [
    `${month}/${day}/${year}`,
    `${month}/${day}/${String(year).slice(-2)}`,
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  ];
  rows.push({
    'Goat Name': name,
    'Ear Tag': String(tag),
    Sex: tag % 5 === 0 ? 'Buck' : 'Doe',
    'Birth Date': formats[tag % 3],
    Breed: tag % 4 === 0 ? 'custom cross' : 'Boer',
    '%': tag % 7 === 0 ? '88%' : '',
    Dam: tag % 3 === 0 ? 'Big Mama' : tag % 3 === 1 ? '101' : '',
    Sire: tag % 4 === 0 ? 'Ace' : tag % 4 === 1 ? 'B02' : 'Some Other Farm Buck',
    'Reg #': '',
    Registry: tag % 10 === 0 ? 'ADGA' : '',
    Tattoo: '',
    Notes: tag % 6 === 0 ? '  ' : '',
  });
  tag += 1;
}

const sheet = XLSX.utils.json_to_sheet(rows);
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, 'Herd 2026');
await mkdir(OUT_DIR, { recursive: true });
const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
await writeFile(OUT_PATH, buffer);
console.log(`Wrote ${OUT_PATH} (${rows.length} goats)`);
