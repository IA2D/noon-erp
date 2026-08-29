import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('src');
const files: string[] = [];

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith('.tsx')) files.push(full);
  }
}

walk(root);
const violations: string[] = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'placeholder') {
      const pos = ast.getLineAndCharacterOfPosition(node.getStart(ast));
      violations.push(`${path.relative(process.cwd(), file)}:${pos.line + 1}: JSX placeholder attribute`);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);

  source.split(/\r?\n/).forEach((line, index) => {
    if (/\bplaceholder\s*(?:\?|=)/.test(line) && !/className\s*=/.test(line)) {
      violations.push(`${path.relative(process.cwd(), file)}:${index + 1}: placeholder prop/default`);
    }
  });
}

if (violations.length) {
  console.error(`NO_INPUT_PLACEHOLDERS_FAILED count=${violations.length}`);
  for (const violation of violations) console.error(violation);
  process.exit(1);
}

console.log(`NO_INPUT_PLACEHOLDERS_OK files=${files.length} jsxAttributes=0 examples=0`);
