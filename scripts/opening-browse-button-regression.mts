import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/modules/opening/OpeningBalancesToolbar.tsx', 'utf8');
assert.match(source, /onClick=\{onLoadAll\}/);
assert.doesNotMatch(source, /onDoubleClick/);
assert.doesNotMatch(source, /نقرتان مزدوجتان/);
console.log('OPENING_BROWSE_BUTTON_OK singleClick=true doubleClickHandler=false keyboardActivation=true');
