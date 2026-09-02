/** Shared renderer/PDF print geometry. No financial values are changed here. */
export const REPORT_PRINT_CSS = `

.report-print-master th, .report-print-master td,
body.report-print-document th, body.report-print-document td {
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  white-space:normal!important;
  overflow:hidden!important;
  height:auto!important;
}
.report-print-master thead th,
body.report-print-document thead th {
  text-align:center!important;
}
@page { size: A4 portrait; margin: 10mm 10mm 18mm; }
@media print {
 body.report-print-document, body.report-print-document * { visibility:visible!important; }
 body.report-print-document #erp-statement-print-zone { display:block!important; position:static!important; }
 body.report-print-document th, body.report-print-document td { overflow-wrap:anywhere!important; word-break:break-word!important; white-space:normal!important; }
 html, body { height:auto!important; min-height:0!important; overflow:visible!important; background:#fff!important; }
 .frp-wrap, .frp-wrap.frp-landscape, .report-page-template, .print-area, .paper,
 .statement-page-item, .voucher-print-wrapper { height:auto!important; min-height:0!important; max-height:none!important; display:block!important; overflow:visible!important; position:static!important; margin:0!important; padding:0!important; width:100%!important; max-width:100%!important; }
 .frp-content { display:block!important; flex:none!important; margin:0!important; }
 .frp-page-foot, .report-footer, .statement-page-footer { position:fixed!important; bottom:-11mm!important; left:0!important; right:0!important; width:100%!important; height:8mm!important; min-height:0!important; margin:0!important; padding:2mm 0 0!important; box-sizing:border-box!important; display:flex!important; align-items:center!important; justify-content:space-between!important; border-top:1px solid #000!important; font-size:6.4px!important; break-inside:avoid!important; }
 .frp-wrap { break-after:auto!important; }
 .frp-wrap + .frp-wrap, .statement-page-item + .statement-page-item { break-before:page; }
 table { table-layout:fixed!important; min-width:0!important; width:96%!important; max-width:96%!important; margin-left:auto!important; margin-right:auto!important; }
 th, td { min-width:0!important; max-width:none!important; overflow:hidden!important; overflow-wrap:anywhere!important; word-break:break-word!important; white-space:normal!important; box-sizing:border-box!important; font-size:7.2px!important; line-height:1.2!important; height:auto!important; }
 th { font-size:8px!important; font-weight:700!important; }
 thead th { text-align:center!important; }
 [data-report-row-number] { width:3%!important; min-width:3%!important; max-width:3%!important; text-align:center!important; }
 thead { display:table-header-group!important; }
 tfoot { display:table-row-group!important; }
 tr { break-inside:avoid!important; }
 [data-report-omit] { display:none!important; }
 .frp-logo, .report-logo, .rpt-logo { width:80px!important; height:80px!important; object-fit:contain!important; border:0!important; border-radius:0!important; }
 .no-print, .table-collapse-toggle { display:none!important; }
 tbody[hidden], tfoot[hidden] { display:table-row-group!important; }
}
`;

/** Hide redundant report columns, including merged summary cells, without changing stored records. */
export function normalizeReport(root) {
  const norm = value => (value || '').replace(/[\u064B-\u065F\u0640]/g, '').trim();
  const reference = text => /^مستند المصدر(?:\s|$|\/)/.test(norm(text));
  for (const table of root.querySelectorAll('table')) {
    if (!table.tHead) continue;
    if (!table.dataset.reportNormalized) {
      const heads = Array.from(table.tHead.rows[0]?.cells || []);
      const removed = new Set(); let offset = 0;
      for (const cell of heads) {
        const span = cell.colSpan;
        if (reference(cell.textContent)) for (let k=0;k<span;k++) removed.add(offset+k);
        offset += span;
      }
      if (removed.size) {
        for (const row of table.rows) {
          let col = 0;
          for (const cell of row.cells) {
            const span = cell.colSpan;
            let retained = 0;
            for (let k=0;k<span;k++) if (!removed.has(col+k)) retained++;
            if (!retained) { cell.dataset.reportOmit = 'true'; cell.style.setProperty('display','none','important'); }
            else cell.colSpan = retained;
            col += span;
          }
        }
        // Colgroups must follow the same mapping (when they have one column per heading).
        const cols = table.querySelectorAll('col');
        if (cols.length === offset) cols.forEach((col,i) => { if (removed.has(i)) col.style.display = 'none'; });
      }
      table.dataset.reportNormalized = 'true';
    }

    // The compact first-column rule belongs only to an actual "#" column. If a
    // report omitted it, create a real row-number column instead of shrinking its
    // first business-data column (account, date, description, etc.).
    if (!table.dataset.reportRowNumbered) {
      const firstHeader = table.tHead.rows[0]?.cells[0];
      const hasNumberColumn = norm(firstHeader?.textContent).replace(/\s/g, '') === '#';
      if (!hasNumberColumn && table.tHead.rows[0]) {
        const numberHead = document.createElement('th');
        numberHead.textContent = '#';
        numberHead.rowSpan = Math.max(1, table.tHead.rows.length);
        numberHead.dataset.reportRowNumber = 'true';
        table.tHead.rows[0].insertBefore(numberHead, firstHeader || null);
        const colgroup = table.querySelector('colgroup');
        if (colgroup) {
          const numberCol = document.createElement('col');
          numberCol.dataset.reportRowNumber = 'true';
          colgroup.insertBefore(numberCol, colgroup.firstElementChild);
        }

        let rowNumber = 0;
        for (const body of table.tBodies) {
          for (const row of body.rows) {
            const originalCells = Array.from(row.cells);
            const mergedOrSummary = originalCells.length === 0
              || originalCells.some(cell => cell.colSpan > 1)
              || /(?:total|summary|subtotal|group)/i.test(row.className);
            const numberCell = row.insertCell(0);
            numberCell.dataset.reportRowNumber = 'true';
            if (!mergedOrSummary) numberCell.textContent = String(++rowNumber);
          }
        }
        for (const footer of table.tFoot ? [table.tFoot] : []) {
          for (const row of footer.rows) {
            const numberCell = row.insertCell(0);
            numberCell.dataset.reportRowNumber = 'true';
          }
        }
      } else if (hasNumberColumn) {
        firstHeader.dataset.reportRowNumber = 'true';
        for (const body of table.tBodies) for (const row of body.rows) row.cells[0]?.setAttribute('data-report-row-number', 'true');
        if (table.tFoot) for (const row of table.tFoot.rows) row.cells[0]?.setAttribute('data-report-row-number', 'true');
      }
      table.dataset.reportRowNumbered = 'true';
    }
  }
  for (const cell of root.querySelectorAll('td')) {
    if (cell.childElementCount) continue;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cell.textContent.trim());
    if (iso && cell.firstChild?.nodeType === 3) cell.firstChild.nodeValue = `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  const groups = new Map();
  for (const item of root.querySelectorAll('.frp-meta-item, .brt-info-cell')) {
    const group = item.parentElement;
    if (!groups.has(group)) groups.set(group,new Set());
    const seen = groups.get(group);
    const label = norm(item.firstElementChild?.textContent).replace(/:$/, '').trim();
    if (reference(label) || (label === 'العملة' && seen.has(label))) {
      item.dataset.reportOmit = 'true'; item.style.setProperty('display','none','important');
    }
    seen.add(label);
  }
}

/** Static report typography. Kept as a compatibility no-op for older callers. */
export function fitReportCells(_root) {
  // Dynamic font fitting was intentionally removed; print CSS owns fixed sizes.
}
