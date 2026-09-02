import { REPORT_PRINT_CSS, normalizeReport, fitReportCells } from './report-layout.mjs';

/** One Chromium pagination path for preview, printing and downloadable desktop PDFs. */
export async function renderReportPdf(webContents) {
  const metadata = await webContents.executeJavaScript(`(async () => {
    await document.fonts.ready;
    await Promise.race([Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload=resolve; img.onerror=resolve; }))), new Promise(resolve => setTimeout(resolve, 5000))]);
    document.body.classList.add('report-print-document');
    const footer = document.querySelector('.frp-page-foot,.report-footer,.statement-page-footer');
    const by = footer?.querySelector('.frp-foot-right')?.textContent || footer?.firstElementChild?.textContent || 'NOON ERP';
    const stamp = footer?.querySelector('.frp-foot-left')?.textContent || new Date().toLocaleString('en-GB');
    const style = document.createElement('style');
    style.textContent = ${JSON.stringify(REPORT_PRINT_CSS)} + '@media print { .frp-page-foot,.report-footer,.statement-page-footer { display:none!important; } }';
    document.body.appendChild(style);
    (${normalizeReport.toString()})(document.body);
    document.body.style.width = '190mm';
    document.body.style.margin = '0';
    for (const root of document.querySelectorAll('.frp-wrap,.paper,.print-area,.report-page-template')) { root.style.setProperty('width','100%','important'); root.style.setProperty('min-width','0','important'); }
    return { by, stamp };
  })()`);
  // Fit using actual print styles, not the wider screen preview.
  const attached = !webContents.debugger.isAttached();
  if (attached) webContents.debugger.attach('1.3');
  try {
    await webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
    await webContents.executeJavaScript(`(${fitReportCells.toString()})(document.body)`);
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return await webContents.printToPDF({
      landscape: false, printBackground: true, pageSize: 'A4', preferCSSPageSize: false,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div dir="rtl" style="box-sizing:border-box;width:100%;margin:0 10mm 5mm;padding-top:2mm;border-top:1px solid #000;display:flex;justify-content:space-between;font:8px Tahoma,Arial;color:#000"><span>${escape(metadata.by)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span><span dir="ltr">${escape(metadata.stamp)}</span></div>`,
      margins: { top: 10/25.4, right: 10/25.4, bottom: 18/25.4, left: 10/25.4 },
    });
  } finally {
    await webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: '' }).catch(() => {});
    if (attached) webContents.debugger.detach();
  }
}
