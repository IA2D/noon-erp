import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createAuthStore } from '../electron/auth-store.mjs';

const source = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
const loginStart = source.indexOf('const handleLogin =');
const loginEnd = source.indexOf('const handleLogout =', loginStart);
assert.ok(loginStart >= 0 && loginEnd > loginStart, 'login handler must exist');
const loginHandler = source.slice(loginStart, loginEnd);
assert.equal(loginHandler.includes('window.prompt('), false, 'default login must not be blocked by a password-change prompt');
assert.equal(loginHandler.includes('window.desktopStore.logout'), false, 'valid default login must not be immediately logged out');
assert.ok(loginHandler.includes('setCurrentUser(user)'), 'valid login must establish the current user');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fullerp-default-login-'));
const db = new DatabaseSync(path.join(dir, 'auth.sqlite'));
const auth = createAuthStore(db);
const result = auth.login('admin', 'admin123');
assert.equal(result.ok, true);
assert.equal(result.user?.username, 'admin');
assert.equal(result.user?.roleId, 'CFO');
db.close();
fs.rmSync(dir, { recursive: true, force: true });

console.log('DEFAULT_LOGIN_FLOW_OK username=admin password=admin123 authenticated=true promptBlocked=false sessionEstablished=true');
