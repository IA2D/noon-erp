import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/modules/CustodyView.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const financialSection = source.slice(source.indexOf('التوجيه المالي والمحاسبي'), source.indexOf('التوجيه المالي والمحاسبي') + 3500);
assert.match(financialSection, /<F9SearchInput/);
assert.match(financialSection, /browseTitle="اختيار مركز التكلفة"/);
assert.match(financialSection, /onSelect=\{center => update\(\{ costCenterId: center\.id \}\)\}/);
assert.match(financialSection, /inputProps=\{\{[\s\S]*?readOnly: true,[\s\S]*?title: 'اضغط F9 لاختيار مركز التكلفة أو Delete لمسح الاختيار'/);
assert.match(financialSection, /event\.key === 'Delete' \|\| event\.key === 'Backspace'/);
assert.match(financialSection, /update\(\{ costCenterId: '' \}\)/);
assert.doesNotMatch(financialSection, /<SearchableSelect/);
console.log('CUSTODY_COST_CENTER_F9_REGRESSION_OK create=true edit=true modalBrowse=true');
