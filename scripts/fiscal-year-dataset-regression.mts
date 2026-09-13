import { partitionLegacyRows, fiscalYearStorageKey, stampFiscalYear } from '../src/utils/fiscalYearDatasetStore';

const rows = [{ id: 'old', date: '2026-12-31' }, { id: 'new', fiscalYear: '2027' }, { id: 'legacy' }];
if (fiscalYearStorageKey('journals', '2027') !== 'journals::fiscal-year::2027') throw new Error('SCOPE_KEY_FAILED');
if (partitionLegacyRows(rows, '2026', '2026').map(r => r.id).join(',') !== 'old,legacy') throw new Error('LEGACY_PARTITION_FAILED');
if (partitionLegacyRows(rows, '2027', '2026').map(r => r.id).join(',') !== 'new') throw new Error('TARGET_PARTITION_FAILED');
if ((stampFiscalYear([{ id: 'x' }], '2027')[0] as { fiscalYear?: string }).fiscalYear !== '2027') throw new Error('STAMP_FAILED');
console.log('FISCAL_YEAR_DATASET_OK partition=true scopedKey=true stamp=true');
