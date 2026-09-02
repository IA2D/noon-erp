import {app,BrowserWindow} from 'electron';
import fs from 'node:fs';import path from 'node:path';
import {renderReportPdf} from '../electron/report-pdf.mjs';
app.on('window-all-closed',()=>{});
app.setPath('userData',path.resolve('transition_artifacts/report-system-v2/electron-test-data'));
app.whenReady().then(async () => {
try {
 const dir=path.resolve('transition_artifacts/report-system-v2');
 const cases=process.argv.includes('--actual') ? JSON.parse(fs.readFileSync(path.join(dir,'actual-report-html.json'),'utf8').replace(/^\uFEFF/,'')).map((item,i)=>{const name=`actual-${i}`;fs.writeFileSync(path.join(dir,`${name}.html`),item.html);return name;}) : process.argv.includes('--baseline')?['baseline-0','baseline-28','baseline-60']:['fixture-0','fixture-1','fixture-28','fixture-60','fixture-150','legacy-empty'];
 for(const name of cases) {
  const window=new BrowserWindow({show:false,width:794,height:1123,webPreferences:{sandbox:true}});
  await window.loadFile(path.join(dir,`${name}.html`));
  const bytes=name.startsWith('baseline')?await window.webContents.printToPDF({landscape:false,printBackground:true,pageSize:'A4',preferCSSPageSize:false,displayHeaderFooter:false,margins:{top:0,right:0,bottom:0,left:0}}):await renderReportPdf(window.webContents);
  fs.writeFileSync(path.join(dir,`${name}.pdf`),bytes);
  const state=await window.webContents.executeJavaScript(`({hidden:[...document.querySelectorAll('[data-report-omit]')].map(e=>e.textContent),shrunk:[...document.querySelectorAll('[data-report-fit]')].filter(e=>parseFloat(e.style.fontSize)<+e.dataset.reportBaseFont).map(e=>({text:e.textContent,size:e.style.fontSize})),logos:[...document.querySelectorAll('.frp-logo')].map(e=>e.getBoundingClientRect().width)})`);
  fs.writeFileSync(path.join(dir,`${name}.json`),JSON.stringify(state,null,2));
  console.log(`${name}: pdf=${bytes.length} hidden=${state.hidden.length} shrunk=${state.shrunk.length}`);window.destroy();
 }
 app.exit(0);
} catch(e){console.error(e);app.exit(1);}

});
