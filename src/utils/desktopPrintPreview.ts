import { REPORT_PRINT_CSS, normalizeReport, fitReportCells } from '../../electron/report-layout.mjs';
/** Opens the same Windows PDF preview flow used by the financial reports. */
export function buildReportPrintHtml(element: HTMLElement, orientation: 'portrait' | 'landscape' = 'portrait'): string {
  // Report normalization changes table structure. It must only touch this detached
  // snapshot; mutating React's live report DOM corrupts later report-type renders.
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute('aria-hidden');
  clone.style.cssText = 'width:100%;position:static;background:#fff;color:#000';
  clone.querySelectorAll<HTMLElement>('[hidden]').forEach(el => el.removeAttribute('hidden'));
  normalizeReport(clone);
  const css = Array.from(document.styleSheets).map(sheet => {
    try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n'); }
    catch { return ''; }
  }).join('\n');
  const printMargins = orientation === 'landscape' ? '8mm 8mm 16mm' : '10mm 10mm 18mm';
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><base href="${document.baseURI}"><style>${css}\n${REPORT_PRINT_CSS}\n@media print{@page{size:A4 ${orientation};margin:${printMargins}!important}html,body{background:#fff!important;margin:0!important}}</style></head><body class="printing-financial-report report-print-document"><div class="report-print-master">${clone.outerHTML}</div></body></html>`;
  return html;
}

export async function desktopReportPdfBytes(element: HTMLElement, title: string): Promise<Uint8Array | null> {
  if (!window.desktopPrint) return null;
  const result = await window.desktopPrint.preview({ title, html: buildReportPrintHtml(element), returnPdf: true });
  if (!result.bytes) throw new Error('لم يتم إنشاء ملف PDF');
  return result.bytes;
}

export async function openDesktopPrintPreview(element: HTMLElement | null, title: string, orientation: 'portrait' | 'landscape' = 'portrait'): Promise<boolean> {
  if (!element) return false;
  const html = buildReportPrintHtml(element, orientation);
  if (window.desktopPrint) return (await window.desktopPrint.preview({ landscape: false, title, html })).opened;
  const popup = window.open('', '_blank', 'width=1000,height=850');
  if (!popup) return false;
  popup.document.write(html); popup.document.close();
  await popup.document.fonts.ready;
  await Promise.race([Promise.all(Array.from(popup.document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload=resolve; img.onerror=resolve; }))), new Promise(resolve => setTimeout(resolve,5000))]);
  popup.addEventListener('beforeprint',()=>fitReportCells(popup.document.body));
  popup.focus(); popup.print();
  return true;
}
