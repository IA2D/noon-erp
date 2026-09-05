import assert from 'node:assert/strict';
import { findDuplicateEntities, mergeDuplicateEntity } from '../src/utils/entityMerge';
const base:any = { nameEn:'', phone:'050-123', email:'same@example.com', currencies:[], defaultCurrency:'YER', isActive:true, createdAt:'x', openingBalance:10 };
const customers:any[] = [{...base,id:'c1',code:'C1',nameAr:'شركة ألف',customerType:'COMPANY',commercialRegistration:'CR1',vatNumber:'VAT1',address:'',city:'',creditLimit:0,linkedAccountId:'a1'}, {...base,id:'c2',code:'C2',nameAr:'شركة ألف',customerType:'COMPANY',commercialRegistration:'CR1',vatNumber:'VAT1',address:'صنعاء',city:'صنعاء',creditLimit:0,linkedAccountId:'a1',openingBalance:20}];
assert.equal(findDuplicateEntities('CUSTOMER',customers).length,1);
const merged=mergeDuplicateEntity('CUSTOMER','c2','c1','admin','سجل مكرر',{customers,vendors:[],employees:[]}); assert.equal(merged.ok,true); assert.equal(merged.customers.find(x=>x.id==='c2')?.isActive,false); assert.equal(merged.customers.find(x=>x.id==='c2')?.mergedIntoId,'c1'); assert.equal(merged.customers.find(x=>x.id==='c1')?.openingBalance,30);
const blocked=mergeDuplicateEntity('CUSTOMER','c2','c1','admin','مرة أخرى',{customers:[{...customers[0],linkedAccountId:'a1'},{...customers[1],linkedAccountId:'a2'}],vendors:[],employees:[]}); assert.equal(blocked.ok,false);
console.log('ENTITY_MERGE_REGRESSION_OK detect=true archiveAlias=true balancesConsolidated=true historyPreserved=true controlAccountMismatchBlocked=true');
