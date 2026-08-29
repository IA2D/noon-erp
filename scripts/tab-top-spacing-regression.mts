import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/ui/TabKeepAliveContainer.tsx', 'utf8');
const header = readFileSync('src/components/ui/PageHeader.tsx', 'utf8');
assert.match(source, /tab\.module === 'HOME' \? '' : 'pt-4'/);
assert.match(source, /className=\{isActive \?/);
assert.match(source, /: 'hidden'/);
assert.match(header, /className="block mb-6/);
assert.doesNotMatch(header, /\bsticky\b|\btop-0\b/);
console.log('TAB_HEADER_FLOW_OK nonHomeMargin=pt-4 position=block sticky=false scrollsWithContent=true home=unchanged sharedContainer=true');
