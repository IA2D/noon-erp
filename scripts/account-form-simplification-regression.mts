import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { initialAccounts } from '../src/data/initialData';
import { normalizeStandardLevelFiveAccountNames } from '../src/utils/accountNaming';
import { subLedgerTypeOf } from '../src/utils/subLedger';

const root = path.resolve(import.meta.dirname, '..');
const modules = ['ChartOfAccountsView.tsx', 'CashBoxesView.tsx', 'BankAccountsView.tsx', 'CustomersView.tsx', 'VendorsView.tsx', 'EmployeesView.tsx'];
const ui = modules.map(name => fs.readFileSync(path.join(root, 'src/components/modules', name), 'utf8')).join('\n');

for (const text of [
  'أول عملة مضمّنة',
  'حساب عام لا يتطلب',
  'Rule B',
  'إدارة عملات الحساب',
  'نوع الحساب المساعد (Sub-Ledger)',
  'يولّد تلقائياً بدلالة',
  'يُولّد تلقائياً بادئة',
  'إجباري — تعرض القائمة'
]) assert.equal(ui.includes(text), false, `obsolete form note/control remains: ${text}`);

const expectedNames = new Map([
  ['1101010001', 'الصندوق العام'],
  ['1101020001', 'البنوك'],
  ['1101020002', 'الصرافات'],
  ['2201010001', 'رأس المال']
]);
for (const [code, name] of expectedNames) assert.equal(initialAccounts.find(account => account.code === code)?.nameAr, name);

const legacy = initialAccounts.map(account => account.code === '1101010001' ? { ...account, nameAr: 'الصندوق الرئيسي', nameEn: 'Main Cash Box' } : account);
assert.equal(normalizeStandardLevelFiveAccountNames(legacy).find(account => account.code === '1101010001')?.nameAr, 'الصندوق العام');
const custom = initialAccounts.map(account => account.code === '1101010001' ? { ...account, nameAr: 'صندوق فرع صنعاء' } : account);
assert.equal(normalizeStandardLevelFiveAccountNames(custom).find(account => account.code === '1101010001')?.nameAr, 'صندوق فرع صنعاء');

const control = { ...initialAccounts.find(account => account.code === '1102010001')!, subLedgerType: 'NONE' as const };
assert.equal(subLedgerTypeOf(control, { accounts: [control], employees: [], customers: [{ id: 'customer-1', code: 'C-1', nameAr: 'عميل', nameEn: 'Customer', linkedAccountId: control.id } as never], vendors: [], cashBoxes: [], banks: [], costCenters: [] }), 'CUSTOMER');

console.log('ACCOUNT_FORM_SIMPLIFICATION_OK notesRemoved=true accountCurrencyControlRemoved=true subLedgerInputRemoved=true derivedSubLedger=CUSTOMER names=الصندوق العام/البنوك/الصرافات/رأس المال customNamePreserved=true');
