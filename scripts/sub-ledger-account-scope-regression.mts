import assert from 'node:assert/strict';
import { listSubLedgers, searchSubLedgers, validateSubLedger, type SubLedgerDataset } from '../src/utils/subLedger';

const dataset = {
  accounts: [
    { id: 'local-customers', code: '1102010001', nameAr: 'عملاء محليون', nameEn: 'Local Customers', level: 5, isActive: true, subLedgerType: 'CUSTOMER' },
    { id: 'government-customers', code: '1102010002', nameAr: 'عملاء حكوميون', nameEn: 'Government Customers', level: 5, isActive: true, subLedgerType: 'CUSTOMER' },
    { id: 'local-vendors', code: '2101010001', nameAr: 'موردون محليون', nameEn: 'Local Suppliers', level: 5, isActive: true, subLedgerType: 'SUPPLIER' },
    { id: 'foreign-vendors', code: '2101010002', nameAr: 'موردون خارجيون', nameEn: 'Foreign Suppliers', level: 5, isActive: true, subLedgerType: 'SUPPLIER' },
  ],
  customers: [
    { id: 'customer-local', code: 'CUS-001', nameAr: 'عميل محلي', nameEn: 'Local Customer', city: '', linkedAccountId: 'local-customers', isActive: true },
    { id: 'customer-government', code: 'CUS-002', nameAr: 'عميل حكومي', nameEn: 'Government Customer', city: '', linkedAccountId: 'government-customers', isActive: true },
  ],
  vendors: [
    { id: 'vendor-local', code: 'SUP-001', nameAr: 'مورد محلي', nameEn: 'Local Supplier', city: '', linkedAccountId: 'local-vendors', isActive: true },
    { id: 'vendor-foreign', code: 'SUP-002', nameAr: 'مورد خارجي', nameEn: 'Foreign Supplier', city: '', linkedAccountId: 'foreign-vendors', isActive: true },
  ],
  employees: [], cashBoxes: [], banks: [], costCenters: [],
} as unknown as SubLedgerDataset;

assert.deepEqual(listSubLedgers(dataset, 'CUSTOMER', 'local-customers').map(item => item.id), ['customer-local']);
assert.deepEqual(searchSubLedgers(dataset, 'CUSTOMER', '', 'government-customers').map(item => item.id), ['customer-government']);
assert.deepEqual(listSubLedgers(dataset, 'SUPPLIER', 'local-vendors').map(item => item.id), ['vendor-local']);
assert.deepEqual(listSubLedgers(dataset, 'SUPPLIER', 'foreign-vendors').map(item => item.id), ['vendor-foreign']);
assert.equal(validateSubLedger(dataset.accounts[0], 'customer-government', dataset).valid, false);
assert.equal(validateSubLedger(dataset.accounts[0], 'customer-local', dataset).valid, true);
console.log('SUB_LEDGER_ACCOUNT_SCOPE_OK customerAndSupplierLookupBoundToSelectedAccount=true');
