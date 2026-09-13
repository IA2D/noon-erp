import { DatabaseSync } from 'node:sqlite';
import { fiscalYearId, normalizeFiscalYear, recordFiscalYear, runAtomic } from '../electron/fiscal-year-context.mjs';

if (normalizeFiscalYear('2027') !== '2027' || fiscalYearId('2027') !== 'fy-2027') throw new Error('YEAR_NORMALIZATION_FAILED');
if (recordFiscalYear({ date: '2026-09-13' }) !== '2026') throw new Error('DATE_YEAR_FAILED');
if (recordFiscalYear({ fiscalYear: '2027', date: '2026-09-13' }) !== '2027') throw new Error('EXPLICIT_YEAR_FAILED');
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE t (value INTEGER)');
runAtomic(db, () => db.prepare('INSERT INTO t VALUES (1)').run());
let rolledBack = false;
try { runAtomic(db, () => { db.prepare('INSERT INTO t VALUES (2)').run(); throw new Error('injected'); }); } catch { rolledBack = db.prepare('SELECT count(*) AS count FROM t').get().count === 1; }
db.close();
if (!rolledBack) throw new Error('ATOMIC_ROLLBACK_FAILED');
console.log('FISCAL_YEAR_CONTEXT_OK normalization=true explicitYear=true atomicRollback=true');
