import { renderReportPdf } from './report-pdf.mjs';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRelationalStore } from './relational-store.mjs';
import { createAccountingCommandStore } from './accounting-command-store.mjs';
import { assertSupportedDataPath, createVerifiedBackup, createVerifiedBackupAt, listVerifiedBackups, restoreLatestVerifiedBackup, restoreVerifiedBackup, verifyDatabaseFile, verifyFullerpBackupFile } from './database-recovery.mjs';
import { createAuthStore } from './auth-store.mjs';
import { bindConfiguredUiScale, normalizeUiScalePercent, uiScaleToZoomFactor } from './ui-scale.mjs';

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
let backupScheduleTimer = null;
const printPreviewWindows = new Set();
const smokeResultPath = process.env.FULLERP_SMOKE_RESULT || '';
const smokeMode = process.env.FULLERP_SMOKE_TEST === '1' && Boolean(smokeResultPath);
const SETTINGS_STORAGE_KEY = 'elite-erp-settings-v6';

function backupFrequencyMs(value) {
  return ({ daily: 24 * 60 * 60_000, weekly: 7 * 24 * 60 * 60_000, monthly: 30 * 24 * 60 * 60_000 })[String(value)] ?? null;
}

function createInternalBackup(reason) {
  const snapshot = createVerifiedBackup(db, backupRoot);
  lastBackup = { ...snapshot, reason, createdAt: new Date().toISOString() };
  return lastBackup;
}

function configureBackupSchedule(settings = {}) {
  if (backupScheduleTimer) clearInterval(backupScheduleTimer);
  backupScheduleTimer = null;
  const interval = backupFrequencyMs(settings.backupFrequency);
  if (!interval || !db) return;
  backupScheduleTimer = setInterval(() => {
    try { createInternalBackup('scheduled'); } catch (error) { console.error('[database-backup:scheduled]', error); }
  }, interval);
}
function readUiScalePercent() {
  try {
    const raw = db?.prepare('SELECT value FROM kv_store WHERE key = ?').get(SETTINGS_STORAGE_KEY)?.value;
    return normalizeUiScalePercent(raw ? JSON.parse(raw)?.uiScalePercent : 100);
  } catch {
    return 100;
  }
}

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
    configureBackupSchedule(savedSettings);
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
      if (name === SETTINGS_STORAGE_KEY) {
        try { configureBackupSchedule(JSON.parse(String(value))); } catch { configureBackupSchedule({}); }
      }
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
    try { event.returnValue = { ok: true, ...createInternalBackup('manual-safety') }; }
    catch (error) { event.returnValue = { ok: false, error: String(error) }; }
  });
  ipcMain.handle('desktop-store:export-backup', async event => {
    const suggestedName = `NOON-ERP-${new Date().toISOString().slice(0, 10)}.sqlite`;
    const choice = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender) ?? undefined, {
      title: 'حفظ نسخة كاملة من بيانات NOON ERP', defaultPath: suggestedName,
      filters: [{ name: 'NOON ERP SQLite Backup', extensions: ['sqlite'] }],
    });
    if (choice.canceled || !choice.filePath) return { ok: false, canceled: true };
    if (path.resolve(choice.filePath) === path.resolve(databasePath)) return { ok: false, error: 'BACKUP_TARGET_IS_ACTIVE_DATABASE' };
    try { return { ok: true, ...createVerifiedBackupAt(db, choice.filePath) }; }
    catch (error) { return { ok: false, error: String(error) }; }
  });
  ipcMain.handle('desktop-store:restore-backup', async event => {
    const choice = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender) ?? undefined, {
      title: 'اختيار نسخة NOON ERP للاستعادة', properties: ['openFile'],
      filters: [{ name: 'NOON ERP SQLite Backup', extensions: ['sqlite', 'db'] }],
    });
    if (choice.canceled || !choice.filePaths[0]) return { ok: false, canceled: true };
    const source = choice.filePaths[0];
    if (path.resolve(source) === path.resolve(databasePath)) return { ok: false, error: 'RESTORE_SOURCE_IS_ACTIVE_DATABASE' };
    const verification = verifyFullerpBackupFile(source);
    if (!verification.ok) return { ok: false, error: `BACKUP_INTEGRITY_${verification.integrity}` };
    try {
      const safetyBackup = createInternalBackup('before-restore');
      db.close();
      db = undefined;
      const result = restoreVerifiedBackup(databasePath, source);
      if (!result.restored) throw new Error(result.error || 'RESTORE_VERIFICATION_FAILED');
      setTimeout(() => { app.relaunch(); app.exit(0); }, 350);
      return { ok: true, integrity: result.integrity, safetyBackup: safetyBackup.path, restarting: true };
    } catch (error) {
      try { if (!db) openDatabase(); } catch (reopenError) { console.error('[database-restore:reopen]', reopenError); }
      return { ok: false, error: String(error) };
    }
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
  ipcMain.on('desktop-window:get-ui-scale', event => {
    const percent = readUiScalePercent();
    event.returnValue = { percent, zoomFactor: uiScaleToZoomFactor(percent) };
  });
  ipcMain.on('desktop-window:set-ui-scale', (event, requestedPercent) => {
    const percent = normalizeUiScalePercent(requestedPercent);
    const zoomFactor = uiScaleToZoomFactor(percent);
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || owner.isDestroyed()) {
      event.returnValue = { ok: false, percent, zoomFactor };
      return;
    }
    owner.webContents.setZoomFactor(zoomFactor);
    event.returnValue = { ok: true, percent, zoomFactor };
  });

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

      const pdf = await renderReportPdf(printSource);
      if (options?.returnPdf === true) return { opened: false, landscape: false, bytes: new Uint8Array(pdf) };
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
        // نافذة المعاينة ابن للنافذة الرئيسية؛ أعدها للواجهة عند الإغلاق بدل
        // ترك Chromium ينقلها إلى حالة التصغير بعد إغلاق الابن.
        setImmediate(() => {
          if (!owner || owner.isDestroyed()) return;
          if (owner.isMinimized()) owner.restore();
          owner.show();
          owner.focus();
        });
      });
      await previewWindow.loadURL(pathToFileURL(previewPath).href);

      return { opened: true, landscape, previewPath };
    } finally {
      if (printSourceWindow && !printSourceWindow.isDestroyed()) printSourceWindow.destroy();
      if (sourcePath) fs.rm(sourcePath, { force: true }, () => {});
    }
  });
}

function registerAttachmentIpc() {
  ipcMain.handle('desktop-file:open-attachment', async (_event, attachment = {}) => {
    const dataUrl = typeof attachment.dataUrl === 'string' ? attachment.dataUrl : '';
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!match) return { ok: false, error: 'ATTACHMENT_DATA_INVALID' };

    const suppliedName = typeof attachment.fileName === 'string' ? attachment.fileName : 'attachment';
    const fileName = path.basename(suppliedName).replace(/[^\p{L}\p{N}._() -]/gu, '_') || 'attachment';
    const openRoot = path.join(app.getPath('temp'), 'FULLERP', 'opened-attachments');
    const targetPath = path.join(openRoot, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`);

    try {
      fs.mkdirSync(openRoot, { recursive: true });
      fs.writeFileSync(targetPath, Buffer.from(match[2].replace(/\s/g, ''), 'base64'), { flag: 'wx' });
      const error = await shell.openPath(targetPath);
      return error ? { ok: false, error } : { ok: true, path: targetPath };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
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
      zoomFactor: uiScaleToZoomFactor(readUiScalePercent()),
    },
  });

  bindConfiguredUiScale(window, readUiScalePercent);

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
    lastBackup = createInternalBackup('startup');
    registerPrintIpc();
    registerAttachmentIpc();
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
  if (backupScheduleTimer) clearInterval(backupScheduleTimer);
  if (db) {
    try { createInternalBackup('shutdown'); } catch (error) { console.error('[database-backup:quit]', error); }
    db.close();
  }
});
