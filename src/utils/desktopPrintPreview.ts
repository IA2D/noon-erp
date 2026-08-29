/** Opens the same Windows PDF preview flow used by the financial reports. */
export async function openDesktopPrintPreview(
  element: HTMLElement | null,
  title: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
): Promise<boolean> {
  if (!element) return false;
  if (!window.desktopPrint) {
    window.print();
    return true;
  }
  const css = Array.from(document.styleSheets).map(sheet => {
    try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n'); }
    catch { return ''; }
  }).join('\n');
  const printMargins = orientation === 'landscape' ? '8mm 8mm 16mm' : '10mm 10mm 18mm';
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><base href="${document.baseURI}"><style>${css}\n@media print{@page{size:A4 ${orientation};margin:${printMargins}!important}html,body{background:#fff!important;margin:0!important}}</style></head><body class="printing-financial-report"><div class="report-print-master">${element.outerHTML}</div></body></html>`;
  const result = await window.desktopPrint.preview({
    landscape: orientation === 'landscape',
    title,
    html,
  });
  return result.opened;
}
