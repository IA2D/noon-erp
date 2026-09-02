import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveScopedShortcutTarget } from '../src/utils/scopedShortcutRegistry';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

assert.equal(resolveScopedShortcutTarget([
  { id: 'only', visible: true, focused: false },
]), 'only', 'a single visible target must retain its shortcut');

assert.equal(resolveScopedShortcutTarget([
  { id: 'first', visible: true, focused: false },
  { id: 'second', visible: true, focused: false },
]), null, 'an unfocused shortcut must not guess between multiple visible targets');

assert.equal(resolveScopedShortcutTarget([
  { id: 'first', visible: true, focused: false },
  { id: 'second', visible: true, focused: true },
]), 'second', 'the focused target must retain its shortcut when several targets are visible');

assert.equal(resolveScopedShortcutTarget([
  { id: 'hidden', visible: false, focused: false },
  { id: 'visible', visible: true, focused: false },
]), 'visible', 'hidden tabs and controls must not make a unique visible target ambiguous');

assert.equal(resolveScopedShortcutTarget([
  { id: 'first', visible: true, focused: true },
  { id: 'second', visible: true, focused: true },
]), null, 'even focus ambiguity must fail closed');

const registry = read('src/utils/scopedShortcutRegistry.ts');
const f9Input = read('src/components/ui/F9SearchInput.tsx');
const journalSearch = read('src/components/modules/JournalSearchBar.tsx');
const narration = read('src/hooks/useNarrationContextMenu.ts');
const openingGrid = read('src/components/modules/opening/OpeningBalancesGrid.tsx');
const subLedgerCell = read('src/components/ui/SubLedgerF9Cell.tsx');

assert.match(registry, /document\.addEventListener\('keydown', handleShortcut, true\)/);
assert.match(registry, /querySelectorAll<HTMLElement>\('\[role="dialog"\]'\)/);
assert.match(registry, /if \(!ownDialog\) return false/);
assert.match(registry, /if \(ownZ < topZ\) return false/);
assert.equal((registry.match(/document\.addEventListener\('keydown', handleShortcut, true\)/g) ?? []).length, 1);
assert.match(f9Input, /shortcutKey = 'F9'/);
assert.match(f9Input, /registerScopedShortcut\(\{[\s\S]*?key: shortcutKey/);
assert.match(journalSearch, /registerScopedShortcut\(\{[\s\S]*?key: 'F9'/);
assert.match(subLedgerCell, /registerScopedShortcut\(\{[\s\S]*?key: 'F9'/);
assert.match(subLedgerCell, /getElement: \(\) => cellRef\.current/);
assert.doesNotMatch(subLedgerCell, /addEventListener\('keydown'/);
assert.doesNotMatch(f9Input, /if \(e\.key === 'F9'\)/);
assert.doesNotMatch(journalSearch, /window\.addEventListener\('keydown'/);

// Other repeated row shortcuts stay on the focused row/grid rather than
// receiving document/window listeners.
assert.match(narration, /onNarrationKeyDown/);
assert.match(narration, /e\.key === 'F3'/);
assert.match(narration, /e\.key === 'F4'/);
assert.doesNotMatch(narration, /(?:document|window)\.addEventListener\('keydown',[\s\S]{0,240}F[34]/);
assert.match(openingGrid, /handleAddShortcut/);
assert.match(openingGrid, /e\.key !== 'F2' && e\.key !== 'Insert'/);
assert.match(openingGrid, /handleCellKeyDown/);

console.log('SCOPED_SHORTCUTS_OK uniqueVisible=true multipleUnfocusedBlocked=true focusedTarget=true hiddenTargetsIgnored=true backgroundModalTargetsIgnored=true ambiguousFocusBlocked=true f9Centralized=true subLedgerFocusedWins=true journalGlobalCollisionRemoved=true rowShortcutsFocused=true');
