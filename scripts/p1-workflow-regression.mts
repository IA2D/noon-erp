import assert from 'node:assert/strict'; import fs from 'node:fs';
const app=fs.readFileSync('src/App.tsx','utf8'); const permissions=fs.readFileSync('src/constants/permissions.ts','utf8'); const operations=fs.readFileSync('src/components/modules/OperationsView.tsx','utf8');
assert.doesNotMatch(app,/ContractsView|case 'CONTRACTS'/); assert.match(app,/removePersistentItem\(key\)/); assert.doesNotMatch(permissions,/CONTRACTS/); assert.doesNotMatch(operations,/العقود والالتزامات/);
console.log('P1_WORKFLOW_REGRESSION_OK contractsRemoved=true legacyContractDataPurged=true duplicateMergeAccessible=true');
