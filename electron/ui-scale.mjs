export const UI_ZOOM_BASE_FACTOR = 0.7;
export const UI_SCALE_MIN_PERCENT = 50;
export const UI_SCALE_MAX_PERCENT = 200;
export const UI_SCALE_DRIFT_CHECK_MS = 1000;

export function normalizeUiScalePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 100;
  return Math.min(UI_SCALE_MAX_PERCENT, Math.max(UI_SCALE_MIN_PERCENT, Math.round(numeric / 5) * 5));
}

export function uiScaleToZoomFactor(percent) {
  return Number((UI_ZOOM_BASE_FACTOR * normalizeUiScalePercent(percent) / 100).toFixed(3));
}

export function bindConfiguredUiScale(window, readPercent, driftCheckMs = UI_SCALE_DRIFT_CHECK_MS) {
  const enforce = () => {
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
    const expected = uiScaleToZoomFactor(readPercent());
    if (Math.abs(window.webContents.getZoomFactor() - expected) > 0.001) {
      window.webContents.setZoomFactor(expected);
    }
  };
  const scheduleEnforce = () => setImmediate(enforce);
  const zoomKeys = new Set(['0', '+', '-', '=', 'add', 'subtract']);

  window.webContents.on('did-finish-load', scheduleEnforce);
  window.webContents.on('zoom-changed', event => {
    event.preventDefault();
    scheduleEnforce();
  });
  window.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && zoomKeys.has(String(input.key).toLowerCase())) {
      event.preventDefault();
      scheduleEnforce();
    }
  });
  window.on('focus', enforce);
  window.on('restore', enforce);
  window.on('maximize', enforce);

  const driftCheck = setInterval(enforce, driftCheckMs);
  driftCheck.unref?.();
  window.once('closed', () => clearInterval(driftCheck));
  enforce();
  return enforce;
}
