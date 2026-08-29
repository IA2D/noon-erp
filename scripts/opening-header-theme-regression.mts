import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/modules/OpeningBalancesView.tsx', 'utf8');
assert.doesNotMatch(source, /text-amber-300 border-amber-500\/40 bg-amber-500\/10/);
assert.match(source, /bg-amber-50 text-amber-950[^\"]*dark:bg-amber-950\/60 dark:text-amber-100/);
assert.match(source, /bg-emerald-50 text-emerald-950[^']*dark:bg-emerald-950\/60 dark:text-emerald-100/);
assert.match(source, /bg-white\/95[^\"]*text-sky-800[^\"]*dark:bg-sky-950\/60 dark:text-sky-100/);
console.log('OPENING_HEADER_THEME_OK lightContrast=true darkContrast=true draft=true balance=true posted=true');
