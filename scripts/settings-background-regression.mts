import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/modules/SettingsView.tsx', 'utf8');
const shell = source.match(/<PageHeader[\s\S]*?\/>\s*<div className="([^"]+)">\s*\{\/\* رأس المركز/);
assert.ok(shell, 'settings content shell was not found');
assert.equal(shell[1], 'overflow-visible');
assert.doesNotMatch(shell[1], /bg-|border|shadow|rounded/);
assert.match(source, /px-6 py-5 rounded-2xl border border-slate-800 bg-slate-900\/60/);

console.log('SETTINGS_BACKGROUND_OK inheritedShell=true standaloneBackground=false outerBorder=false outerShadow=false centerHeaderPreserved=true');
