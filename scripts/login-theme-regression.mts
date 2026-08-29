import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/LoginView.tsx', 'utf8');
assert.doesNotMatch(source, /Building2/);
assert.match(source, /fullerp-icon-128\.png[^>]+dark:hidden/);
assert.match(source, /fullerp-icon-dark-128\.png[^>]+dark:block/);
assert.equal((source.match(/<input/g) || []).length, 2);
assert.equal((source.match(/<select/g) || []).length, 1);
assert.equal((source.match(/dark:focus:bg-slate-900/g) || []).length, 3);
assert.equal((source.match(/focus:text-slate-950/g) || []).length, 3);
assert.equal((source.match(/dark:focus:text-white/g) || []).length, 3);
assert.equal((source.match(/caret-sky-600/g) || []).length, 2);
assert.equal((source.match(/dark:caret-sky-400/g) || []).length, 2);
console.log('LOGIN_THEME_OK logo=true inputs=2 fiscalYearSelect=1 lightInput=true darkInput=true focusedTextVisible=true caretVisible=true');
