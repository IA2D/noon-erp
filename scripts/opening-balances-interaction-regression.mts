import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');
const f9 = read('src/components/ui/F9SearchInput.tsx');
const grid = read('src/components/modules/opening/OpeningBalancesGrid.tsx');
const view = read('src/components/modules/OpeningBalancesView.tsx');
const employees = read('src/components/modules/EmployeesView.tsx');
const customers = read('src/components/modules/CustomersView.tsx');
const vendors = read('src/components/modules/VendorsView.tsx');

assert.match(f9, /modalSearchRef\.current\?\.focus\(\)/);
assert.doesNotMatch(f9, /setTimeout\(\(\) => inputRef\.current\?\.focus/);
assert.match(f9, /shortcutKey = 'F9'/);
assert.match(grid, /shortcutKey="F8"/);
assert.match(grid, /الحساب المساعد \(F8\)/);
assert.match(grid, /w-72 min-w-72/);
assert.match(grid, /w-44 max-w-44/);
assert.match(view, /current\?\.account\?\.code === t/);
assert.match(view, /l\.entity\?\.id === entity\.id/);
assert.match(view, /return lines\.map\(l =>/);
assert.match(view, /handleBrowseWithAutoSave/);
assert.match(view, /تم حفظ التغييرات تلقائياً/);
assert.match(view, /تجاهل السطور غير المكتملة والمتابعة/);
assert.match(view, /loadSavedIntoMainGrid/);
assert.match(view, /const merged = \[\.\.\.sourceLines, \.\.\.newLines\]/);
assert.doesNotMatch(view, /<SavedBalancesModal|isBrowseOpen/);
assert.match(view, /browseRows\.length === 0/);
assert.match(view, /browseRows\.map\(\(row, idx\)/);
for (const source of [employees, customers, vendors]) {
  assert.match(source, /w-80 flex-shrink-0 min-w-0/);
}
assert.match(employees, /إضافة موظف جديد/);
assert.match(employees, /bg-sky-600 hover:bg-sky-500 text-\[#ffffff\]/);
console.log('OPENING_BALANCES_INTERACTION_OK focus=modal shortcuts=F9+F8 enterPreserves=true autosaveBrowse=true savedRows=primary-grid printSavedRows=true entityPriority=true lightButtons=true');
