import { desktopReportPdfBytes } from './desktopPrintPreview';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export async function elementToPdf(element: HTMLElement, orientation: 'portrait' | 'landscape' = 'portrait'): Promise<jsPDF> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;

  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf;
}

export async function downloadVoucherPdf(element: HTMLElement, fileName: string, orientation: 'portrait' | 'landscape' = 'portrait'): Promise<void> {
  const bytes = await desktopReportPdfBytes(element, fileName);
  if (bytes) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], {type:'application/pdf'}));
    const link = document.createElement('a'); link.href=url; link.download=fileName; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  const pdf = await elementToPdf(element, orientation);
  pdf.save(fileName);
}

export async function shareVoucherPdf(element: HTMLElement, fileName: string, title: string): Promise<boolean> {
  const bytes = await desktopReportPdfBytes(element, fileName);
  const blob = bytes ? new Blob([new Uint8Array(bytes)], {type:'application/pdf'}) : (await elementToPdf(element)).output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text: title });
      return true;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return true;
    }
  }
  return false;
}

export function voucherFileName(prefix: string, number: string): string {
  const safe = number.replace(/[^\w\d-]/g, '-');
  return `${prefix}-${safe}.pdf`;
}
