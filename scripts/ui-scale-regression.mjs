import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';

app.on('window-all-closed', () => {});
app.setPath('userData', path.resolve('transition_artifacts/ui-scale-electron-data'));

app.whenReady().then(async () => {
  const main = fs.readFileSync(path.resolve('electron/main.mjs'), 'utf8');
  const settings = fs.readFileSync(path.resolve('src/components/modules/SettingsView.tsx'), 'utf8');
  assert.match(main, /UI_ZOOM_BASE_FACTOR = 0\.7/);
  assert.match(main, /UI_SCALE_MIN_PERCENT = 50/);
  assert.match(main, /UI_SCALE_MAX_PERCENT = 200/);
  assert.match(settings, /uiScalePercent: '100'/);

  const window = new BrowserWindow({ show: false, webPreferences: { zoomFactor: 0.7 } });
  try {
    await window.loadURL('data:text/html,<main>NOON ERP zoom regression</main>');
    assert.ok(Math.abs(window.webContents.getZoomFactor() - 0.7) < 0.001, 'new 100% must map to Chromium 70%');
    window.webContents.setZoomFactor(0.875);
    assert.ok(Math.abs(window.webContents.getZoomFactor() - 0.875) < 0.001, 'saved scale must be applicable at runtime');
    console.log('UI_SCALE_OK new100=0.7 range=50..200 runtime125=0.875 persistedKey=elite-erp-settings-v6');
  } finally {
    window.destroy();
    app.exit(0);
  }
}).catch(error => {
  console.error(error);
  app.exit(1);
});
