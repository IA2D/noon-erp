import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  console.log(`PATCH_CHECK_OK ${message}`);
};

const login = read('src/components/LoginView.tsx');
assert(!login.includes('focus:bg-white'), 'login focus does not use theme-remapped white utility');
assert((login.match(/focus:bg-\[#ffffff\]/g) ?? []).length === 3, 'all login controls keep a literal light focus background');
assert((login.match(/dark:focus:bg-\[#0f172a\]/g) ?? []).length === 3, 'all login controls keep a literal dark focus background');
assert((login.match(/dark:focus:text-\[#ffffff\]/g) ?? []).length === 3, 'focused login text remains visible in dark mode');

const home = read('src/components/modules/HomePageView.tsx');
assert(home.includes('repeat(auto-fit,minmax(min(100%,15rem),1fr))'), 'home cards use an auto-fit responsive grid');
assert(home.includes('auto-rows-fr') && home.includes('h-full min-h-0'), 'home grid shares available height without fixed card sizes');
assert(!home.includes('rounded-2xl p-7'), 'home cards no longer use fixed padding');

const initialData = read('src/data/initialData.ts');
assert(!initialData.includes("code: 'EUR'"), 'EUR is absent from the default currency directory');
const app = read('src/App.tsx');
assert(app.includes("new Set(['AED', 'EUR', 'GBP'])"), 'existing persisted EUR/GBP references are migrated out');

const currencies = read('src/components/modules/CurrenciesView.tsx');
const types = read('src/types/erp.ts');
const currencyType = types.slice(types.indexOf('export interface Currency {'), types.indexOf('export type ExchangeRateType'));
assert(currencies.includes('إضافة عملة جديدة') && !currencies.includes('MAX_CURRENCIES'), 'new-currency action is always available');
assert(!currencies.includes('modal.form.notes') && !currencyType.includes('notes?'), 'currency notes are removed from form and domain type');
assert(currencies.includes('>سعر التحويل *</label>') && !currencies.includes('سعر الصرف (مقابل الأساسية)'), 'currency rate field is named سعر التحويل');

const controller = read('src/components/ui/TableCollapseController.tsx');
assert(app.includes('<TableCollapseController />'), 'global table collapse controller is mounted');
assert(controller.includes("querySelectorAll<HTMLTableElement>('table')"), 'all interactive tables are discovered');
assert(controller.includes("state.set(table, table.dataset.tableExpanded !== 'false')"), 'tables default to expanded');
assert(controller.includes('body.hidden = !expanded') && controller.includes("addEventListener('beforeprint'"), 'tables collapse and automatically expand for printing');
assert(controller.includes('row?.cells[row.cells.length - 1]') && controller.includes("document.addEventListener('click', onClick, true)"), 'collapse controls stay at the far-left RTL header and use stable delegated clicks');

console.log('FIRST_PATCH_REGRESSION_OK checks=17');
