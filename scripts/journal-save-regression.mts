import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('src/App.tsx');
const journalView = read('src/components/modules/JournalEntriesView.tsx');

assert.match(journalView, /interface JournalSaveResult \{ ok: boolean; error\?: string; \}/);
assert.match(journalView, /const saveResult = editingJournal[\s\S]*?\? onUpdateJournal[\s\S]*?: onAddJournal\(newEntry\);/);
assert.match(journalView, /if \(!saveResult\.ok\) \{[\s\S]*?toast\('error', error\);[\s\S]*?return;/);
assert.match(journalView, /if \(!saveResult\.ok\)[\s\S]*?return;[\s\S]*?setSelectedEntryId\(newEntry\.id\);[\s\S]*?closeJournalModal\(\);/);
assert.match(app, /const handleAddJournal = \(newEntry: JournalEntry\): \{ ok: boolean; error\?: string \} =>/);
assert.match(app, /return \{ ok: false, error: 'تعذر حفظ القيد في قاعدة البيانات\. لم تُفقد بيانات النموذج\.' \};/);
assert.match(app, /const handleAddJournalBoolean = \(newEntry: JournalEntry\): boolean => handleAddJournal\(newEntry\)\.ok;/);
assert.match(app, /const handleUpdateJournal = \(id: string, updated: JournalEntry, opts\?: \{ skipClosedCheck\?: boolean \}\): \{ ok: boolean; error\?: string \} =>/);

console.log('JOURNAL_SAVE_REGRESSION_OK rejection-preserves-form success-closes-form');