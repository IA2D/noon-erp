import assert from 'node:assert/strict';
import { calculateAccountActivity, calculateBalanceSheet, calculateIncomeStatement } from '../src/utils/accountingEngine';
import { initialAccounts } from '../src/data/initialData';
const accounts:any[]=initialAccounts; const cash=accounts.find(item=>item.code==='1101010001'); const revenue=accounts.find(item=>item.code==='3101010001');
const journals=Array.from({length:20_000},(_,index)=>({id:`j${index}`,entryNumber:`JV-${index}`,date:`2026-${String(index%12+1).padStart(2,'0')}-01`,narration:'load',lines:[{id:`d${index}`,accountId:cash.id,accountCode:cash.code,accountNameAr:cash.nameAr,debit:1,credit:0,description:''},{id:`c${index}`,accountId:revenue.id,accountCode:revenue.code,accountNameAr:revenue.nameAr,debit:0,credit:1,description:''}],totalDebit:1,totalCredit:1,currency:'YER',exchangeRate:1,status:'POSTED',createdBy:'load',createdAt:'x'}));
const start=performance.now(); const activity=calculateAccountActivity(accounts,journals as any); const income=calculateIncomeStatement(accounts,journals as any); const balance=calculateBalanceSheet(accounts,journals as any); const elapsed=performance.now()-start;
assert.equal(activity[cash.id].debit,20_000); assert.equal(income.totalRevenues,20_000); assert.equal(balance.isBalanced,true); assert.ok(elapsed<5_000,`performance ${elapsed}ms exceeded 5000ms`);
console.log(`PERFORMANCE_REGRESSION_OK journals=20000 elapsedMs=${elapsed.toFixed(1)} thresholdMs=5000 balanced=${balance.isBalanced}`);
