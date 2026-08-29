export interface XlsxColumn {
  key: string;
  title: string;
  width?: number;
}

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function writeU16(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
}

function writeU32(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}

function textBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const offsets: number[] = [];

  let offset = 0;
  for (const e of entries) {
    const nameBytes = textBytes(e.name);
    const crc = crc32(e.data);
    offsets.push(offset);

    localParts.push(
      writeU32(0x04034b50), // signature
      writeU16(20), // version needed
      writeU16(0x0800), // flags (UTF-8)
      writeU16(0), // method: store
      writeU16(0), // mod time
      writeU16(0), // mod date
      writeU32(crc),
      writeU32(e.data.length), // compressed size
      writeU32(e.data.length), // uncompressed size
      writeU16(nameBytes.length),
      writeU16(0),
      nameBytes,
      e.data
    );

    centralParts.push(
      writeU32(0x02014b50), // signature
      writeU16(20),
      writeU16(20),
      writeU16(0x0800),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU32(crc),
      writeU32(e.data.length),
      writeU32(e.data.length),
      writeU16(nameBytes.length),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU32(0), // external attrs
      writeU32(offset),
      nameBytes
    );

    offset += 30 + nameBytes.length + e.data.length;
  }

  const local = concatBytes(localParts);
  const central = concatBytes(centralParts);

  const eocd = concatBytes([
    writeU32(0x06054b50), // signature
    writeU16(0),
    writeU16(0),
    writeU16(entries.length),
    writeU16(entries.length),
    writeU32(central.length),
    writeU32(local.length),
    writeU16(0),
  ]);

  return concatBytes([local, central, eocd]);
}

function colLetter(index: number): string {
  let col = '';
  let n = index;
  while (n >= 0) {
    col = String.fromCharCode((n % 26) + 65) + col;
    n = Math.floor(n / 26) - 1;
  }
  return col;
}

function sheetXml(sheet: XlsxSheet, sheetId: number): string {
  const header = sheet.columns.map((c, i) => {
    const ref = colLetter(i) + '1';
    return `<c r="${ref}" t="inlineStr" s="1"><is><t>${xmlEscape(c.title)}</t></is></c>`;
  });

  const rows = sheet.rows.map((row, ri) => {
    const cells = sheet.columns.map((c, ci) => {
      const ref = colLetter(ci) + String(ri + 2);
      const v = row[c.key];
      if (v === null || v === undefined || v === '') return `<c r="${ref}"/>`;
      if (typeof v === 'number') {
        const val = Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '0';
        return `<c r="${ref}" s="2"><v>${val}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr" s="1"><is><t>${xmlEscape(String(v))}</t></is></c>`;
    });
    return `<row r="${ri + 2}">${cells.join('')}</row>`;
  });

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${colLetter(sheet.columns.length - 1)}${sheet.rows.length + 1}"/>` +
    `<sheetViews><sheetView workbookViewId="${sheetId}"/></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    '<cols>' +
    sheet.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join('') +
    '</cols>' +
    `<sheetData><row r="1">${header.join('')}</row>${rows.join('')}</sheetData>` +
    '</worksheet>'
  );
}

const CONTENT_TYPES = (sheetCount: number): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  Array.from({length: sheetCount}, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK = (sheets: Array<{name: string}>) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets>' +
  sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
  '</sheets>' +
  '</workbook>';

const WORKBOOK_RELS = (sheetCount: number) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  Array.from({length: sheetCount}, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
  '</Relationships>';

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2">' +
  '<numFmt numFmtId="164" formatCode="#,##0.00"/>' +
  '<numFmt numFmtId="165" formatCode="#,##0.00_);[Red](#,##0.00)"/>' +
  '</numFmts>' +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

export function buildXlsx(sheets: XlsxSheet[], bookName = 'FULLERP-Report'): Blob {
  const cleanSheets = sheets.map((s, i) => ({
    ...s,
    name: (s.name || `Sheet${i + 1}`).replace(/[\\/*?:[\]]/g, '_').slice(0, 31),
  }));

  const entries: ZipEntry[] = [];
  entries.push({name: '[Content_Types].xml', data: textBytes(CONTENT_TYPES(cleanSheets.length))});
  entries.push({name: '_rels/.rels', data: textBytes(ROOT_RELS)});
  entries.push({name: 'xl/workbook.xml', data: textBytes(WORKBOOK(cleanSheets))});
  entries.push({name: 'xl/_rels/workbook.xml.rels', data: textBytes(WORKBOOK_RELS(cleanSheets.length))});
  entries.push({name: 'xl/styles.xml', data: textBytes(STYLES)});
  cleanSheets.forEach((s, i) => {
    entries.push({name: `xl/worksheets/sheet${i + 1}.xml`, data: textBytes(sheetXml(s, i))});
  });

  const zip = buildZip(entries);
  return new Blob([zip as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
