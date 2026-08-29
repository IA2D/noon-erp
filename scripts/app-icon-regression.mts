import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for (const file of ['public/brand/fullerp-icon.png', 'public/brand/fullerp-icon-128.png', 'build/icon.png', 'build/icon.ico']) {
  assert.equal(existsSync(file), true, `missing ${file}`);
}
const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const main = readFileSync('electron/main.mjs', 'utf8');
const html = readFileSync('index.html', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
assert.doesNotMatch(sidebar, /fullerp-icon/);
assert.match(navbar, /fullerp-icon-64\.png/);
assert.match(navbar, /fullerp-icon-dark-64\.png/);
assert.match(navbar, /PRODUCT_NAME/);
assert.match(main, /build', 'icon\.png/);
assert.match(html, /fullerp-icon-32\.png/);
assert.equal(pkg.build.win.icon, 'build/icon.ico');
console.log('APP_ICON_OK png=true ico=true sidebarBrand=false navbarBrand=true lightDarkCorrect=true browserWindow=true executable=true favicon=true');
