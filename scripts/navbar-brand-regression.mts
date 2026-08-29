import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
const brand = readFileSync('src/constants/brand.ts', 'utf8');
assert.match(brand, /PRODUCT_NAME = 'NOON ERP'/);
assert.match(brand, /PRODUCT_TAGLINE_AR = 'Finance & Accounting'/);
assert.match(navbar, /aria-label=\{`\$\{PRODUCT_NAME\} for Finance & Accounting`\}/);
assert.match(navbar, /fullerp-icon-64\.png[^>]+dark:hidden/);
assert.match(navbar, /fullerp-icon-dark-64\.png[^>]+dark:block/);
assert.doesNotMatch(sidebar, /fullerp-icon/);
console.log('NAVBAR_BRAND_OK name=NOON_ERP subtitle=Finance_Accounting location=topNavbar sidebarLogo=false lightDarkCorrect=true');
