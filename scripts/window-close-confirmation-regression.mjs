import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.match(source, /function openVisibleWindowCount\(\)/);
assert.match(source, /BrowserWindow\.getAllWindows\(\)\.filter\(window => !window\.isDestroyed\(\) && window\.isVisible\(\)\)/);
assert.match(source, /function confirmQuitWithOpenWindows\(owner\)/);
assert.match(source, /message: 'هناك أكثر من نافذة مفتوحة'/);
assert.match(source, /detail: 'سيؤدي إغلاق البرنامج إلى إغلاق جميع النوافذ المفتوحة\. هل تريد المتابعة؟'/);
assert.match(source, /window\.on\('close', event => \{/);
assert.match(source, /if \(quitConfirmed \|\| openVisibleWindowCount\(\) <= 1\) return;/);
assert.match(source, /event\.preventDefault\(\);\n    if \(confirmQuitWithOpenWindows\(window\)\) app\.quit\(\);/);
assert.match(source, /app\.on\('before-quit', event => \{/);
assert.match(source, /if \(!confirmQuitWithOpenWindows\(mainWindow\)\) \{/);
console.log('WINDOW_CLOSE_CONFIRMATION_REGRESSION_OK mainClose=true appQuit=true visibleWindowsOnly=true');
