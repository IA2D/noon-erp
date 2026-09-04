import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { bindConfiguredUiScale } from '../electron/ui-scale.mjs';

app.on('window-all-closed', () => {});
app.setPath('userData', path.resolve('transition_artifacts/ui-scale-electron-data'));

app.whenReady().then(async () => {
  const main = fs.readFileSync(path.resolve('electron/main.mjs'), 'utf8');
  const settings = fs.readFileSync(path.resolve('src/components/modules/SettingsView.tsx'), 'utf8');
  const uiScale = fs.readFileSync(path.resolve('electron/ui-scale.mjs'), 'utf8');
  assert.match(uiScale, /UI_ZOOM_BASE_FACTOR = 0\.7/);
  assert.match(uiScale, /UI_SCALE_MIN_PERCENT = 50/);
  assert.match(uiScale, /UI_SCALE_MAX_PERCENT = 200/);
  assert.match(uiScale, /UI_SCALE_DRIFT_CHECK_MS = 1000/);
  assert.match(uiScale, /window\.webContents\.on\('zoom-changed'/);
  assert.match(uiScale, /window\.webContents\.on\('before-input-event'/);
  assert.match(uiScale, /setInterval\(enforce, driftCheckMs\)/);
  assert.match(main, /bindConfiguredUiScale\(window, readUiScalePercent\)/);
  assert.match(settings, /uiScalePercent: '100'/);

  const window = new BrowserWindow({ show: false, webPreferences: { zoomFactor: 0.7 } });
  try {
    bindConfiguredUiScale(window, () => 100, 50);
    await window.loadURL('data:text/html,<main>NOON ERP zoom regression</main>');
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(Math.abs(window.webContents.getZoomFactor() - 0.7) < 0.001, 'new 100% must map to Chromium 70%');
    window.webContents.setZoomFactor(1);
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.ok(Math.abs(window.webContents.getZoomFactor() - 0.7) < 0.001, 'runtime zoom drift must be repaired without reload');
    console.log('UI_SCALE_OK new100=0.7 range=50..200 forcedDrift=1 repaired=0.7 persistedKey=elite-erp-settings-v6 zoomDriftGuard=events+watchdog');
  } finally {
    window.destroy();
    app.exit(0);
  }
}).catch(error => {
  console.error(error);
  app.exit(1);
});
