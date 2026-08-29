import { app, BrowserWindow, ipcMain } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRelationalStore } from './relational-store.mjs';
import { createAccountingCommandStore } from './accounting-command-store.mjs';
import { assertSupportedDataPath, createVerifiedBackup, listVerifiedBackups, restoreLatestVerifiedBackup, verifyDatabaseFile } from './database-recovery.mjs';
import { createAuthStore } from './auth-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let db;
let databasePath;
let dataRoot;
let relationalStore;
let accountingCommandStore;
let backupRoot;
let lastBackup = null;
let startupRecovery = null;
let authStore;
let activeSessionToken = null;
const printPreviewWindows = new Set();
const smokeResultPath = process.env.FULLERP_SMOKE_RESULT || '';
const smokeMode = process.env.FULLERP_SMOKE_TEST === '1' && Boolean(smokeResultPath);

// Keep the existing on-disk database location stable after the product name
// changed from FULLERP to NOON ERP.
if (app.isPackaged && !process.env.FULLERP_DATA_DIR) {
  app.setPath('userData', path.join(app.getPath('appData'), 'FULLERP'));
}

function openDatabase() {
  dataRoot = assertSupportedDataPath(process.env.FULLERP_DATA_DIR || app.getPath('userData'));
  fs.mkdirSync(dataRoot, { recursive: true });
  databasePath = path.join(dataRoot, 'FULLERP.sqlite');
  backupRoot = path.join(dataRoot, 'backups');
  if (fs.existsSync(databasePath)) {
    const current = verifyDatabaseFile(databasePath);
    if (!current.ok) {
      startupRecovery = restoreLatestVerifiedBackup(databasePath, backupRoot);
      if (!startupRecovery.restored) throw new Error(`SQLite integrity failed (${current.integrity}) and recovery failed: ${startupRecovery.error}`);
    }
  }
  db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'app_state',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_kv_store_entity_type ON kv_store(entity_type);
    INSERT INTO app_metadata(key, value) VALUES ('schema_version', '2')
      ON CONFLICT(key) DO UPDATE SET value=excluded.value;
  `);
  relationalStore = createRelationalStore(db);
  relationalStore.ensureSchema();
  accountingCommandStore = createAccountingCommandStore(db, relationalStore);
  authStore = createAuthStore(db);
  try {
    const rawSettings = db.prepare("SELECT value FROM kv_store WHERE key='elite-erp-settings-v6'").get()?.value;
    const savedSettings = rawSettings ? JSON.parse(rawSettings) : {};
    authStore.configureSecurity({ sessionTimeoutMinutes: Number(savedSettings.sessionTimeout || 30) });
  } catch {}
  return databasePath;
}

function registerStorageIpc() {
  const get = db.prepare('SELECT value FROM kv_store WHERE key = ?');
  const set = db.prepare(`
    INSERT INTO kv_store(key, value, entity_type, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, entity_type=excluded.entity_type, updated_at=datetime('now')
  `);
  const remove = db.prepare('DELETE FROM kv_store WHERE key = ?');
  const entries = db.prepare('SELECT key, value FROM kv_store ORDER BY key');
  const detailedEntries = db.prepare('SELECT key, value, entity_type, updated_at FROM kv_store ORDER BY key');

  ipcMain.on('desktop-store:get', (event, key) => {
    const name = String(key);
    const cached = get.get(name)?.value ?? null;
    event.returnValue = cached === null ? null : (relationalStore.readCollection(name) ?? cached);
  });
  ipcMain.on('desktop-store:set-versioned', (event, key, value, expectedVersion) => {
    event.returnValue = accountingCommandStore.executeVersionedSet(String(key), String(value), expectedVersion);
  });
  ipcMain.on('desktop-store:set', (event, key, value) => {
    const name = String(key);
    try {
      db.exec('BEGIN IMMEDIATE');
      set.run(name, String(value), name.startsWith('elite-erp-') ? 'erp_state' : 'app_state');
      relationalStore.syncCollection(name, String(value));
      accountingCommandStore.bumpVersion(name);
      db.exec('COMMIT');
      event.returnValue = true;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      console.error('[desktop-store:set]', error);
      event.returnValue = false;
    }
  });
  ipcMain.on('desktop-store:remove', (event, key) => {
    const name = String(key);
    try {
      db.exec('BEGIN IMMEDIATE');
      const changed = remove.run(name).changes > 0;
      relationalStore.clearCollection(name);
      accountingCommandStore.bumpVersion(name);
      db.exec('COMMIT');
      event.returnValue = changed;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      console.error('[desktop-store:remove]', error);
      event.returnValue = false;
    }
  });
  ipcMain.on('desktop-store:entries', event => {
    event.returnValue = entries.all().map(row => [row.key, relationalStore.readCollection(row.key) ?? row.value]);
  });
  ipcMain.on('desktop-store:replace-entries', (event, incomingEntries, clearPrefixes = ['elite-erp-']) => {
    const normalizedEntries = Array.isArray(incomingEntries)
      ? incomingEntries
          .filter(item => Array.isArray(item) && item.length >= 2)
          .map(([key, value]) => [String(key), String(value)])
      : [];
    const prefixes = Array.isArray(clearPrefixes) ? clearPrefixes.map(String) : ['elite-erp-'];
    const previousRows = detailedEntries.all();
    const rowsToRemove = previousRows.filter(row => prefixes.some(prefix => row.key.startsWith(prefix)));

    try {
      db.exec('BEGIN IMMEDIATE');
      rowsToRemove.forEach(row => remove.run(row.key));
      normalizedEntries.forEach(([key, value]) => {
        set.run(key, value, key.startsWith('elite-erp-') ? 'erp_state' : 'app_state');
      });
      relationalStore.rebuildAll(new Map(entries.all().map(row => [row.key, row.value])));
      db.exec('COMMIT');
      const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check ?? 'unknown';
      event.returnValue = {
        ok: true,
        restored: normalizedEntries.length,
        removed: rowsToRemove.length,
        integrity,
        total: entries.all().length,
      };
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      event.returnValue = { ok: false, restored: 0, removed: 0, integrity: 'not-run', total: entries.all().length, error: String(error) };
    }
  });
  ipcMain.on('desktop-store:info', event => {
    event.returnValue = { databasePath, engine: 'SQLite', schemaVersion: 3, entries: entries.all().length, relational: relationalStore.info(), diagnostics: relationalStore.diagnostics(), authority: 'RELATIONAL_SQLITE', recovery: { dataPathPolicy: 'LOCAL_DISK_ONLY', backupRoot, verifiedBackups: listVerifiedBackups(backupRoot).length, lastBackup, startupRecovery } };
  });
  ipcMain.on('desktop-store:create-backup', event => {
    try { lastBackup = createVerifiedBackup(db, backupRoot); event.returnValue = { ok: true, ...lastBackup }; }
    catch (error) { event.returnValue = { ok: false, error: String(error) }; }
  });
  ipcMain.on('desktop-store:version', (event, key) => {
    event.returnValue = accountingCommandStore.versionOf(String(key));
  });
  ipcMain.on('desktop-store:accounting-command', (event, payload) => {
    const session = authStore?.session(activeSessionToken);
    if (session?.ok && session.user?.roleId === 'AUDITOR') {
      event.returnValue = { ok: false, error: 'AUDITOR_WRITE_FORBIDDEN', permissionDenied: true };
      return;
    }
    event.returnValue = accountingCommandStore.execute(payload);
  });
  ipcMain.on('auth:login', (event, username, password) => { try { const result = authStore.login(username, password); if (result.ok) activeSessionToken = result.token; event.returnValue = result; } catch (error) { event.returnValue = { ok: false, error: String(error) }; } });
  ipcMain.on('auth:session', (event, token) => { event.returnValue = authStore.session(token || activeSessionToken); });
  ipcMain.on('auth:logout', (event, token) => { const result = authStore.logout(token || activeSessionToken); activeSessionToken = null; event.returnValue = result; });
  ipcMain.on('auth:change-password', (event, token, currentPassword, nextPassword) => { event.returnValue = authStore.changePassword(token || activeSessionToken, currentPassword, nextPassword); });
  ipcMain.on('auth:configure-security', (event, options) => { event.returnValue = authStore.configureSecurity(options); });

  try {
    db.exec('BEGIN IMMEDIATE');
    relationalStore.rebuildAll(new Map(entries.all().map(row => [row.key, row.value])));
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('[relational-projection:startup]', error);
  }
}

function registerPrintIpc() {
  ipcMain.handle('desktop-print:preview', async (event, options = {}) => {
    const landscape = options?.landscape === true;
    const title = String(options?.title || 'FULLERP Report').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
    const previewRoot = path.join(app.getPath('temp'), 'FULLERP', 'print-previews');
    fs.mkdirSync(previewRoot, { recursive: true });
    const html = typeof options?.html === 'string' ? options.html : '';
    const sourcePath = html ? path.join(previewRoot, `${title}-${Date.now()}.html`) : null;
    let printSourceWindow = null;
    let printSource = event.sender;

    try {
      if (sourcePath) {
        fs.writeFileSync(sourcePath, html, 'utf8');
        printSourceWindow = new BrowserWindow({
          width: landscape ? 1122 : 794,
          height: landscape ? 794 : 1122,
          show: false,
          backgroundColor: '#ffffff',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        await printSourceWindow.loadURL(pathToFileURL(sourcePath).href);
        await printSourceWindow.webContents.executeJavaScript('document.fonts?.ready');
        printSource = printSourceWindow.webContents;
      }

      const pdf = await printSource.printToPDF({
        landscape,
        printBackground: true,
        pageSize: 'A4',
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      const previewPath = path.join(previewRoot, `${title}-${Date.now()}.pdf`);
      fs.writeFileSync(previewPath, pdf);

      const owner = BrowserWindow.fromWebContents(event.sender);
      const previewWindow = new BrowserWindow({
        width: 1180,
        height: 860,
        minWidth: 820,
        minHeight: 640,
        show: false,
        parent: owner || undefined,
        title: `${title} — Print Preview`,
        backgroundColor: '#ffffff',
        autoHideMenuBar: true,
        webPreferences: {
          plugins: true,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      printPreviewWindows.add(previewWindow);
      previewWindow.once('ready-to-show', () => previewWindow.show());
      previewWindow.once('closed', () => {
        printPreviewWindows.delete(previewWindow);
        fs.rm(previewPath, { force: true }, () => {});
      });
      await previewWindow.loadURL(pathToFileURL(previewPath).href);

      return { opened: true, landscape, previewPath };
    } finally {
      if (printSourceWindow && !printSourceWindow.isDestroyed()) printSourceWindow.destroy();
      if (sourcePath) fs.rm(sourcePath, { force: true }, () => {});
    }
  });
}

function createWindow() {
  const appIcon = path.join(__dirname, '..', 'build', 'icon.png');
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (!smokeMode) window.once('ready-to-show', () => window.show());
  if (app.isPackaged) {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    window.loadURL('http://localhost:3000');
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') window.webContents.openDevTools();
  }
  return window;
}

function writeSmokeResult(payload, exitCode) {
  try {
    fs.mkdirSync(path.dirname(smokeResultPath), { recursive: true });
    fs.writeFileSync(smokeResultPath, JSON.stringify(payload, null, 2), 'utf8');
  } finally {
    app.exit(exitCode);
  }
}

function runPackagedSmoke(window) {
  const timeout = setTimeout(() => {
    writeSmokeResult({ ok: false, error: 'PACKAGED_SMOKE_TIMEOUT' }, 1);
  }, 30000);
  window.webContents.once('did-fail-load', (_event, code, description) => {
    clearTimeout(timeout);
    writeSmokeResult({ ok: false, error: 'RENDERER_LOAD_FAILED', code, description }, 1);
  });
  window.webContents.once('did-finish-load', async () => {
    try {
      // did-finish-load can precede React's first committed frame in a packaged
      // renderer; wait briefly so the smoke probe validates the real login UI.
      await new Promise(resolve => setTimeout(resolve, 1000));
      const renderer = await window.webContents.executeJavaScript(`(() => {
        const text = document.body?.innerText || '';
        const login = window.desktopStore?.login('admin', 'admin123');
        const info = window.desktopStore?.info();
        if (login?.token) window.desktopStore.logout(login.token);
        return {
          brand: text.includes('NOON ERP'),
          loginForm: text.includes('تسجيل الدخول'),
          fiscalYearSelector: text.includes('العام الافتراضي'),
          loginOk: login?.ok === true,
          roleId: login?.user?.roleId || null,
          sqlite: info?.engine === 'SQLite',
          integrity: info?.diagnostics?.integrity || info?.relational?.integrity || null,
          authority: info?.authority || null,
        };
      })()`);
      const ok = renderer.brand && renderer.loginForm && renderer.fiscalYearSelector
        && renderer.loginOk && renderer.sqlite && renderer.authority === 'RELATIONAL_SQLITE';
      clearTimeout(timeout);
      writeSmokeResult({ ok, renderer, packaged: app.isPackaged, version: app.getVersion(), productName: app.getName() }, ok ? 0 : 1);
    } catch (error) {
      clearTimeout(timeout);
      writeSmokeResult({ ok: false, error: String(error?.stack || error) }, 1);
    }
  });
}

app.whenReady().then(() => {
  try {
    openDatabase();
    registerStorageIpc();
    lastBackup = createVerifiedBackup(db, backupRoot);
    registerPrintIpc();
    const window = createWindow();
    if (smokeMode) runPackagedSmoke(window);
  } catch (error) {
    const target = dataRoot || app.getPath('userData');
    fs.writeFileSync(path.join(target, 'desktop-startup-error.log'), String(error?.stack || error));
    app.quit();
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (db) {
    try { lastBackup = createVerifiedBackup(db, backupRoot); } catch (error) { console.error('[database-backup:quit]', error); }
    db.close();
  }
});
