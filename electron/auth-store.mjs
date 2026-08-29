import crypto from 'node:crypto';

const DEFAULT_USERS = [
  ['admin', 'المدير المالي', 'CFO', 'admin123'],
  ['manager', 'المحاسب المالي', 'ACCOUNTANT', 'manager123'],
  ['accountant', 'المحاسب', 'ACCOUNTANT', 'accountant123'],
  ['auditor', 'المدقق المالي', 'AUDITOR', 'auditor123'],
];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 64).toString('hex') };
}
function verifyPassword(password, salt, expected) {
  const actual = Buffer.from(hashPassword(password, salt).hash, 'hex');
  const target = Buffer.from(expected, 'hex');
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}
function parseDbTimestamp(value) {
  const text = String(value || '');
  return new Date(/Z$|[+-]\d\d:\d\d$/.test(text) ? text : `${text.replace(' ', 'T')}Z`);
}

export function createAuthStore(db) {
  let sessionIdleTimeoutMs = 30 * 60_000;
  db.exec(`CREATE TABLE IF NOT EXISTS auth_users (username TEXT PRIMARY KEY, name TEXT NOT NULL, role_id TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 1, failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')));
    CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES auth_users(username) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT(datetime('now')), expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL DEFAULT(datetime('now')), revoked_at TEXT);`);
  try { db.exec("ALTER TABLE auth_sessions ADD COLUMN last_seen_at TEXT NOT NULL DEFAULT(datetime('now'))"); } catch {}
  const insert = db.prepare('INSERT OR IGNORE INTO auth_users(username,name,role_id,password_salt,password_hash,must_change_password) VALUES(?,?,?,?,?,1)');
  for (const [username, name, role, password] of DEFAULT_USERS) { const value = hashPassword(password); insert.run(username, name, role, value.salt, value.hash); }
  // ترقية الحساب الافتراضي القديم الذي كان اسمه "accountant" لكنه مُسجل خطأً كمدقق للقراءة فقط.
  db.prepare("UPDATE auth_users SET name='المحاسب', role_id='ACCOUNTANT', updated_at=datetime('now') WHERE username='accountant' AND role_id='AUDITOR' AND name='المدقق المالي'").run();
  const getUser = db.prepare('SELECT * FROM auth_users WHERE username=? AND is_active=1');
  const revoke = db.prepare('UPDATE auth_sessions SET revoked_at=datetime(\'now\') WHERE username=? AND revoked_at IS NULL');
  function login(username, password) {
    const user = getUser.get(String(username).trim());
    if (!user) return { ok: false, error: 'INVALID_CREDENTIALS' };
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) return { ok: false, error: 'ACCOUNT_LOCKED' };
    if (!verifyPassword(password, user.password_salt, user.password_hash)) {
      const attempts = Number(user.failed_attempts || 0) + 1;
      db.prepare('UPDATE auth_users SET failed_attempts=?, locked_until=? WHERE username=?').run(attempts, attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null, user.username);
      return { ok: false, error: 'INVALID_CREDENTIALS' };
    }
    db.prepare('UPDATE auth_users SET failed_attempts=0,locked_until=NULL WHERE username=?').run(user.username);
    revoke.run(user.username);
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 8 * 60 * 60_000).toISOString();
    db.prepare('INSERT INTO auth_sessions(token_hash,username,expires_at,last_seen_at) VALUES(?,?,?,datetime(\'now\'))').run(crypto.createHash('sha256').update(token).digest('hex'), user.username, expires);
    return { ok: true, token, user: { username: user.username, name: user.name, roleId: user.role_id, mustChangePassword: Boolean(user.must_change_password), expiresAt: expires } };
  }
  function session(token) {
    if (!token) return { ok: false };
    const hash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const row = db.prepare(`SELECT u.username,u.name,u.role_id,u.must_change_password,s.expires_at,s.last_seen_at FROM auth_sessions s JOIN auth_users u ON u.username=s.username WHERE s.token_hash=? AND s.revoked_at IS NULL AND u.is_active=1`).get(hash);
    if (!row || parseDbTimestamp(row.expires_at).getTime() <= Date.now() || Date.now() - parseDbTimestamp(row.last_seen_at).getTime() > sessionIdleTimeoutMs) return { ok: false };
    db.prepare("UPDATE auth_sessions SET last_seen_at=datetime('now') WHERE token_hash=?").run(hash);
    return { ok: true, user: { username: row.username, name: row.name, roleId: row.role_id, mustChangePassword: Boolean(row.must_change_password), expiresAt: row.expires_at } };
  }
  function logout(token) { if (token) db.prepare('UPDATE auth_sessions SET revoked_at=datetime(\'now\') WHERE token_hash=?').run(crypto.createHash('sha256').update(String(token)).digest('hex')); return true; }
  function changePassword(token, currentPassword, nextPassword) {
    const current = session(token);
    if (!current.ok || !current.user) return { ok: false, error: 'SESSION_INVALID' };
    const user = getUser.get(current.user.username);
    if (!user || !verifyPassword(currentPassword, user.password_salt, user.password_hash)) return { ok: false, error: 'CURRENT_PASSWORD_INVALID' };
    if (typeof nextPassword !== 'string' || nextPassword.length < 10) return { ok: false, error: 'PASSWORD_POLICY' };
    if (verifyPassword(nextPassword, user.password_salt, user.password_hash)) return { ok: false, error: 'PASSWORD_REUSE' };
    const value = hashPassword(nextPassword);
    db.prepare('UPDATE auth_users SET password_salt=?,password_hash=?,must_change_password=0,failed_attempts=0,locked_until=NULL,updated_at=datetime(\'now\') WHERE username=?').run(value.salt, value.hash, current.user.username);
    return { ok: true };
  }
  function configureSecurity(options = {}) {
    const minutes = Number(options.sessionTimeoutMinutes);
    if (!Number.isFinite(minutes) || minutes < 15 || minutes > 480) return { ok: false, error: 'SESSION_TIMEOUT_INVALID' };
    sessionIdleTimeoutMs = Math.round(minutes) * 60_000;
    return { ok: true, sessionTimeoutMinutes: Math.round(minutes) };
  }
  return { login, session, logout, changePassword, configureSecurity };
}
