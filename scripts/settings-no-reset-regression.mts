import assert from 'node:assert/strict';
import fs from 'node:fs';

const settings = fs.readFileSync('src/components/modules/SettingsView.tsx', 'utf8');
const i18n = fs.readFileSync('src/i18n.tsx', 'utf8');

assert.doesNotMatch(settings, /handleReset|settings\.resetDefaults|settings\.resetToast|<RotateCcw/);
assert.doesNotMatch(i18n, /settings\.resetDefaults|settings\.resetToast|استعادة الإعدادات الافتراضية|إستعادة الإعدادات الإفتراضية/);
assert.match(settings, /onClick=\{handleSave\}/);

console.log('SETTINGS_NO_RESET_OK allSections=true resetButton=false resetHandler=false resetTranslations=false savePreserved=true');
