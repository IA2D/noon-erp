import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`;

export function assertSupportedDataPath(dataPath) {
  const resolved = path.resolve(String(dataPath));
  if (process.platform === 'win32' && (/^\\\\/.test(String(dataPath)) || /^\/\//.test(String(dataPath)))) {
    throw new Error('FULLERP_DATA_DIR must be on a local disk; UNC/network SQLite paths are not supported.');
  }
  return resolved;
}

export function verifyDatabaseFile(file) {
  if (!fs.existsSync(file)) return { ok: false, integrity: 'missing' };
  let probe;
  try {
    probe = new DatabaseSync(file, { readOnly: true });
    const integrity = probe.prepare('PRAGMA integrity_check').get()?.integrity_check ?? 'unknown';
    return { ok: integrity === 'ok', integrity };
  } catch (error) {
    return { ok: false, integrity: 'unreadable', error: String(error) };
  } finally {
    try { probe?.close(); } catch {}
  }
}

/** A user-selected restore file must be a NOON ERP database, not merely valid SQLite. */
export function verifyFullerpBackupFile(file) {
  const base = verifyDatabaseFile(file);
  if (!base.ok) return base;
  let probe;
  try {
    probe = new DatabaseSync(file, { readOnly: true });
    const names = new Set(probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    const required = ['kv_store', 'auth_users', 'erp_accounts'];
    const missing = required.filter(name => !names.has(name));
    return missing.length === 0 ? { ...base, format: 'FULLERP_SQLITE' } : { ok: false, integrity: base.integrity, error: `Not a NOON ERP backup; missing ${missing.join(', ')}.` };
  } catch (error) {
    return { ok: false, integrity: 'unreadable', error: String(error) };
  } finally {
    try { probe?.close(); } catch {}
  }
}

export function listVerifiedBackups(backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir).filter(name => /^FULLERP-\d{8}-\d{6}(?:-\d{3})?\.sqlite$/.test(name)).map(name => path.join(backupDir, name)).sort().reverse().filter(file => verifyDatabaseFile(file).ok);
}

export function createVerifiedBackup(db, backupDir, keep = 7, now = new Date()) {
  fs.mkdirSync(backupDir, { recursive: true });
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  let target = path.join(backupDir, `FULLERP-${stamp}.sqlite`);
  if (fs.existsSync(target)) target = path.join(backupDir, `FULLERP-${stamp}-${String(now.getMilliseconds()).padStart(3, '0')}.sqlite`);
  db.exec(`VACUUM INTO ${sqlLiteral(target)}`);
  const verification = verifyDatabaseFile(target);
  if (!verification.ok) {
    fs.rmSync(target, { force: true });
    throw new Error(`Backup verification failed: ${verification.integrity}`);
  }
  const backups = fs.readdirSync(backupDir).filter(name => /^FULLERP-\d{8}-\d{6}(?:-\d{3})?\.sqlite$/.test(name)).map(name => path.join(backupDir, name)).sort().reverse();
  backups.slice(Math.max(1, keep)).forEach(file => fs.rmSync(file, { force: true }));
  return { path: target, integrity: verification.integrity, retained: Math.min(backups.length, Math.max(1, keep)) };
}

/** Create a self-contained SQLite snapshot at a caller-selected path. */
export function createVerifiedBackupAt(db, targetPath) {
  const target = path.resolve(String(targetPath));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) fs.rmSync(target, { force: true });
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  db.exec(`VACUUM INTO ${sqlLiteral(target)}`);
  const verification = verifyDatabaseFile(target);
  if (!verification.ok) {
    fs.rmSync(target, { force: true });
    throw new Error(`Backup verification failed: ${verification.integrity}`);
  }
  return { path: target, integrity: verification.integrity };
}

/** Replace a closed database with a verified SQLite snapshot. */
export function restoreVerifiedBackup(databasePath, sourcePath) {
  const source = path.resolve(String(sourcePath));
  const target = path.resolve(String(databasePath));
  const sourceVerification = verifyDatabaseFile(source);
  if (!sourceVerification.ok) return { restored: false, integrity: sourceVerification.integrity, error: 'Selected backup failed integrity_check.' };
  fs.copyFileSync(source, target);
  const verification = verifyDatabaseFile(target);
  return { restored: verification.ok, source, integrity: verification.integrity, error: verification.ok ? undefined : 'Restored file did not pass integrity_check.' };
}

export function restoreLatestVerifiedBackup(databasePath, backupDir) {
  const latest = listVerifiedBackups(backupDir)[0];
  if (!latest) return { restored: false, error: 'No verified backup is available.' };
  if (fs.existsSync(databasePath)) fs.renameSync(databasePath, `${databasePath}.corrupt-${Date.now()}`);
  return restoreVerifiedBackup(databasePath, latest);
}
