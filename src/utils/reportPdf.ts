import { openDesktopPrintPreview } from './desktopPrintPreview';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export interface ReportPdfOptions {
  orientation?: 'portrait' | 'landscape';
  /** هامش الصفحة بالملم (افتراضي 10) */
  margin?: number;
  /** دقة التصوير (افتراضي 2 — يكفي للطباعة) */
  scale?: number;
  /** اسم ملف عند الحفظ (اختياري) */
  fileName?: string;
}

export async function generateReportPdf(
  contentElement: HTMLElement,
  options: ReportPdfOptions = {}
): Promise<jsPDF> {
  const {
    orientation = 'portrait',
    margin = 10,
    scale = 2,
    fileName,
  } = options;

  const canvas = await html2canvas(contentElement, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    ignoreElements: (el) => el.classList.contains('report-pdf-exclude'),
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  const imgFullW = contentW;
  const imgFullH = (canvas.height * imgFullW) / canvas.width;

  const totalPages = Math.max(1, Math.ceil(imgFullH / contentH));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    const srcY = page * (contentH / imgFullW) * canvas.width;
    const sliceH = Math.min(contentH / imgFullW * canvas.width, canvas.height - srcY);

    const sliceHOnPage = (sliceH * imgFullW) / canvas.width;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.round(sliceH);
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        canvas,
        0, Math.round(srcY), canvas.width, Math.round(sliceH),
        0, 0, canvas.width, Math.round(sliceH)
      );
    }

    const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(sliceData, 'JPEG', margin, margin, contentW, sliceHOnPage);
  }

  if (fileName) pdf.save(fileName);
  return pdf;
}

export function printReport(element: HTMLElement, orientation: 'portrait' | 'landscape' = 'portrait'): void {
  void openDesktopPrintPreview(element, 'تقرير', orientation);
}
