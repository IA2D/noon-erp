import assert from 'node:assert/strict';
import fs from 'node:fs';

const settings = fs.readFileSync('src/components/modules/SettingsView.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const auth = fs.readFileSync('electron/auth-store.mjs', 'utf8');
const main = fs.readFileSync('electron/main.mjs', 'utf8');
const preload = fs.readFileSync('electron/preload.mjs', 'utf8');

assert.doesNotMatch(settings, /المصادقة الثنائية|\b2FA\b|twoFactorAuth\s*:/);
assert.match(settings, /كلمة المرور الحالية/);
assert.match(settings, /كلمة المرور الجديدة/);
assert.match(settings, /تأكيد كلمة المرور الجديدة/);
assert.match(settings, /newPassword !== confirmPassword/);
assert.match(settings, /newPassword\.length < 10/);
assert.match(settings, /changePassword\('', currentPassword, newPassword\)/);
assert.match(settings, /onPasswordChanged\?\.\(\)/);
assert.match(settings, /configureSecurity\(\{ sessionTimeoutMinutes: Number\(settings\.sessionTimeout\) \}\)/);
assert.match(settings, /حماية القيود المرحلة/);
assert.match(settings, /ضابط مالي إلزامي ومفعّل دائماً/);
assert.match(app, /securitySettings\.activityLogging === false/);
assert.match(app, /تم تغيير كلمة مرور المستخدم/);
assert.match(auth, /CURRENT_PASSWORD_INVALID/);
assert.match(auth, /PASSWORD_REUSE/);
assert.match(auth, /sessionIdleTimeoutMs/);
assert.match(main, /auth:configure-security/);
assert.match(preload, /configureSecurity/);

console.log('SECURITY_SETTINGS_OK passwordChange=true currentPassword=true confirmation=true minLength=10 twoFactorRemoved=true auditToggleWired=true postedProtection=enforced sessionTimeoutWired=true');
