import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { REPORT_PRINT_CSS, normalizeReport } from '../electron/report-layout.mjs';
import { renderReportPdf } from '../electron/report-pdf.mjs';

app.on('window-all-closed', () => {});
app.setPath('userData', path.resolve('transition_artifacts/report-cell-containment-electron-data'));

app.whenReady().then(async () => {
  const openingBalancesSource = fs.readFileSync(path.resolve('src/components/modules/OpeningBalancesView.tsx'), 'utf8');
  assert.doesNotMatch(openingBalancesSource, /<table className="w-full text-xs border border-slate-300">/, 'global text-xs override must not inflate the printed opening-balances table');
  const outputDir = path.resolve('transition_artifacts/report-cell-containment');
  fs.mkdirSync(outputDir, { recursive: true });
  const htmlPath = path.join(outputDir, 'fixture.html');
  fs.writeFileSync(htmlPath, `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    ${REPORT_PRINT_CSS}
    body{width:190mm;margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}
    table{width:100%;table-layout:fixed;border-collapse:collapse}td{border:1px solid #000;padding:4px 5px;font:900 10px Consolas,monospace;white-space:nowrap;overflow:hidden}
    .fit-pair,.report-fit-pair{display:inline-flex;width:100%;min-width:0;align-items:center;justify-content:space-between;gap:4px;overflow:hidden}
  </style></head><body class="report-print-document"><table><tbody><tr>
    <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td id="raw" colspan="2" style="text-align:left">الفرق: 1,231,231.00</td>
  </tr><tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td id="paired" colspan="2"><span class="report-fit-pair" dir="rtl"><span>الفرق:</span><span dir="ltr">1,231,231.00</span></span></td></tr></tbody></table>
  <table id="already-numbered"><thead><tr><th>#</th><th>اسم الحساب</th></tr></thead><tbody><tr><td>7</td><td>الصندوق</td></tr></tbody></table>
  <table id="auto-numbered"><colgroup><col style="width:20%"><col style="width:80%"></colgroup><thead><tr><th>اسم الحساب</th><th>المبلغ</th></tr></thead><tbody><tr><td id="wrap-cell">اسم حساب طويل للغاية يجب أن يلتف داخل الخلية ولا يخرج منها</td><td>10</td></tr><tr><td>البنك</td><td>20</td></tr><tr class="summary"><td colspan="2">الإجمالي 30</td></tr></tbody></table>
  </body></html>`, 'utf8');

  const window = new BrowserWindow({ show: false, width: 794, height: 1123, webPreferences: { sandbox: true } });
  try {
    await window.loadFile(htmlPath);
    await window.webContents.executeJavaScript(`(${normalizeReport.toString()})(document.body);(${normalizeReport.toString()})(document.body)`);
    const numbering = await window.webContents.executeJavaScript(`({
      existingHead: document.querySelector('#already-numbered thead th')?.textContent,
      existingCells: document.querySelectorAll('#already-numbered tbody tr:first-child td').length,
      autoHeads: Array.from(document.querySelectorAll('#auto-numbered thead th')).map(cell => cell.textContent),
      autoRows: Array.from(document.querySelectorAll('#auto-numbered tbody tr')).map(row => Array.from(row.cells).map(cell => cell.textContent)),
      marked: document.querySelectorAll('#auto-numbered [data-report-row-number]').length,
      cols: document.querySelectorAll('#auto-numbered colgroup col').length,
    })`);
    assert.equal(numbering.existingHead, '#', 'an existing # heading must be reused');
    assert.equal(numbering.existingCells, 2, 'an existing # table must not receive a duplicate column');
    assert.deepEqual(numbering.autoHeads, ['#', 'اسم الحساب', 'المبلغ']);
    assert.deepEqual(numbering.autoRows[0], ['1', 'اسم حساب طويل للغاية يجب أن يلتف داخل الخلية ولا يخرج منها', '10']);
    assert.deepEqual(numbering.autoRows[1], ['2', 'البنك', '20']);
    assert.equal(numbering.autoRows[2][0], '', 'summary rows receive an unnumbered alignment cell');
    assert.equal(numbering.marked, 5, 'colgroup, header and all three body alignment cells are marked');
    assert.equal(numbering.cols, 3, 'a matching numbering col is prepended to an existing colgroup');
    const headerAlignments = await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('thead th')).map(cell => getComputedStyle(cell).textAlign)`);
    assert.ok(headerAlignments.length >= 5 && headerAlignments.every(value => value === 'center'), 'all report column headers must be centered');
    const wrapping = await window.webContents.executeJavaScript(`(()=>{const cell=document.getElementById('wrap-cell');const style=getComputedStyle(cell);return{whiteSpace:style.whiteSpace,overflowWrap:style.overflowWrap,wordBreak:style.wordBreak,scrollWidth:cell.scrollWidth,clientWidth:cell.clientWidth,height:cell.getBoundingClientRect().height,fontSize:parseFloat(style.fontSize)}})()`);
    assert.equal(wrapping.whiteSpace, 'normal');
    assert.equal(wrapping.overflowWrap, 'anywhere');
    assert.ok(wrapping.scrollWidth <= wrapping.clientWidth + 1, `wrapped cell overflowed horizontally: ${wrapping.scrollWidth} > ${wrapping.clientWidth}`);
    assert.ok(wrapping.height > wrapping.fontSize * 1.8, 'long cell text must occupy multiple lines');
    const cells = await window.webContents.executeJavaScript(`['raw','paired'].map(id=>{const cell=document.getElementById(id);const range=document.createRange();range.selectNodeContents(cell);const c=cell.getBoundingClientRect(),r=range.getBoundingClientRect(),s=getComputedStyle(cell);const left=c.left+parseFloat(s.paddingLeft),right=c.right-parseFloat(s.paddingRight);const kids=cell.querySelectorAll('.report-fit-pair > span');const pairOverlap=kids.length===2?Math.max(0,Math.min(kids[0].getBoundingClientRect().right,kids[1].getBoundingClientRect().right)-Math.max(kids[0].getBoundingClientRect().left,kids[1].getBoundingClientRect().left)):0;const childOverflow=Array.from(kids).reduce((max,kid)=>{const kr=document.createRange();kr.selectNodeContents(kid);const rect=kr.getBoundingClientRect();return Math.max(max,left-rect.left,rect.right-right,0)},0);return{id,text:cell.textContent,font:parseFloat(s.fontSize),leftOverflow:Math.max(0,left-r.left),rightOverflow:Math.max(0,r.right-right),pairOverlap,childOverflow}})`);
    for (const cell of cells) {
      assert.equal(cell.text.replace(/\s+/g, ''), 'الفرق:1,231,231.00');
      assert.ok(cell.leftOverflow <= 0.25, `${cell.id} left overflow ${cell.leftOverflow}`);
      assert.ok(cell.rightOverflow <= 0.25, `${cell.id} right overflow ${cell.rightOverflow}`);
      assert.equal(cell.pairOverlap, 0, `${cell.id} label and amount overlap by ${cell.pairOverlap}px`);
      assert.ok(cell.childOverflow <= 0.25, `${cell.id} child glyph clipping ${cell.childOverflow}px`);
    }
    assert.equal(cells[0].font, 10, `screen fixture must retain its explicit 10px font, got ${cells[0].font}px`);
    assert.equal(cells[1].font, 10, `screen fixture must retain its explicit 10px font, got ${cells[1].font}px`);
    assert.match(REPORT_PRINT_CSS, /font-size:7\.2px!important/, 'print cells must use the requested 20% smaller static font');
    assert.match(REPORT_PRINT_CSS, /width:96%/i, 'print tables must leave horizontal inset on both sides');
    const pdf = await renderReportPdf(window.webContents);
    fs.writeFileSync(path.join(outputDir, 'fixture.pdf'), pdf);
    console.log(`REPORT_CELL_CONTAINMENT_OK screenFixtureFont=${cells[0].font} printFont=7.2 tableWidth=96% autoNumbering=true headersCentered=true cellWrap=true horizontalTextOverflow=0 existingHashReused=true summaryBlank=true leftOverflow=0 rightOverflow=0 pdfBytes=${pdf.length}`);
  } finally {
    window.destroy();
    app.exit(0);
  }
}).catch(error => { console.error(error); app.exit(1); });
