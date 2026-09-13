import { cloneYearDataset, validateClonedYearGraph } from '../electron/fiscal-year-rollover.mjs';

const source = {
  accounts: [{ id: 'A1', code: '1101', parentId: null, fiscalYear: '2026' }, { id: 'A2', code: '110101', parentId: 'A1', fiscalYear: '2026' }],
  cashBoxes: [{ id: 'C1', linkedAccountId: 'A2', fiscalYear: '2026' }],
  journals: [{ id: 'J1', date: '2026-12-31', fiscalYear: '2026', lines: [{ id: 'L1', accountId: 'A2' }] }],
};
const cloned = cloneYearDataset(source, '2026', '2027');
const check = validateClonedYearGraph(source, cloned);
if (!check.ok || check.count !== 4) throw new Error(`ROLLOVER_GRAPH_FAILED:${JSON.stringify({ check, cloned: cloned.collections })}`);
const sourceAccount = source.accounts[0].id;
const targetAccount = cloned.collections.accounts[0].id;
if (sourceAccount === targetAccount || cloned.collections.accounts[1].parentId !== targetAccount || cloned.collections.cashBoxes[0].linkedAccountId !== cloned.collections.accounts[1].id) throw new Error('ROLLOVER_LINK_REMAP_FAILED');
if (cloned.collections.journals[0].date !== '2027-12-31' || cloned.collections.journals[0].lines[0].accountId !== cloned.collections.accounts[1].id) throw new Error('ROLLOVER_DATE_OR_LINE_FAILED');
console.log(`FISCAL_YEAR_ROLLOVER_OK rows=${check.count} sourceIdsIndependent=true linksRemapped=true datesShifted=true`);
