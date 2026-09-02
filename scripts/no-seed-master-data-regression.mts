import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialCustomers, initialEmployees, initialVendors } from '../src/data/initialData';
import { nextEntityCode } from '../src/utils/accountingEngine';

assert.deepEqual(initialEmployees, [], 'employees must start empty');
assert.deepEqual(initialCustomers, [], 'customers must start empty');
assert.deepEqual(initialVendors, [], 'vendors must start empty');

assert.equal(nextEntityCode([], 'EMP'), 'EMP-001');
assert.equal(nextEntityCode([], 'CUST', ['CUS']), 'CUST-001');
assert.equal(nextEntityCode([], 'SUP'), 'SUP-001');

const app = readFileSync('src/App.tsx', 'utf8');
const gitignore = readFileSync('.gitignore', 'utf8');
assert.match(gitignore, /^\/data\/$/m, 'only the root runtime data directory should be ignored');
assert.doesNotMatch(gitignore, /^data\/$/m, 'src/data must remain source-controlled');
assert.match(app, /noon-erp-remove-shipped-party-records-v1/);
assert.equal((app.match(/'emp-00[1-3]\|EMP-00[1-3]\|/g) ?? []).length, 3);
assert.equal((app.match(/'cus-00[1-3]\|CUST-00[1-3]\|/g) ?? []).length, 3);
assert.equal((app.match(/'sup-00[1-3]\|SUP-00[1-3]\|/g) ?? []).length, 3);
assert.match(app, /shippedEmployees\.has\(signature\(entity\)\)/);
assert.match(app, /shippedCustomers\.has\(signature\(entity\)\)/);
assert.match(app, /shippedVendors\.has\(signature\(entity\)\)/);

for (const view of ['EmployeesView.tsx', 'CustomersView.tsx', 'VendorsView.tsx']) {
  const source = readFileSync(`src/components/modules/${view}`, 'utf8');
  assert.match(source, /filtered\.length === 0/, `${view} must retain its empty state`);
}

console.log('NO_SEED_MASTER_DATA_OK employees=0 customers=0 vendors=0 nextCodes=EMP-001,CUST-001,SUP-001 migrationSignatures=9 emptyStates=3');
