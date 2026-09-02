import pdfplumber, re, json
from pathlib import Path
root=Path('transition_artifacts/report-system-v2');results=[]
for count,expected_pages in [(0,1),(1,1),(28,1),(60,2),(150,4)]:
 p=root/f'fixture-{count}.pdf'
 with pdfplumber.open(p) as doc:
  assert len(doc.pages)==expected_pages,(p,len(doc.pages))
  all_text=''
  for i,page in enumerate(doc.pages):
   text=page.extract_text() or '';all_text+=text+'\n'
   assert page.width<page.height,'Landscape'
   assert text.count('PDF-TEST')==1,(p,i,'missing/duplicate footer')
   assert 'ROW-' in text or (count==0 and 'EMPTY REPORT' in text),(p,i,'footer-only page')
   footer=[w for w in page.extract_words() if 'PDF-TEST' in w['text']]
   assert all(w['top']>page.height-45 for w in footer),(p,i,footer)
   assert 'DUPLICATE' not in text,(p,i,'reference/source visible')
  numbers=re.findall(r'ROW-(\d+)',all_text)
  assert sorted(map(int,numbers))==list(range(1,count+1)),(p,numbers)
  results.append({'rows':count,'pages':len(doc.pages),'footerEveryPage':True,'rowsPreserved':True,'portrait':True})
with pdfplumber.open(root/'baseline-0.pdf') as d:
 assert len(d.pages)==2
 assert 'EMPTY REPORT' not in d.pages[1].extract_text()
with pdfplumber.open(root/'legacy-empty.pdf') as d: assert len(d.pages)==1
(root/'pdf-verification.json').write_text(json.dumps(results,indent=2))
print('REPORT_PDF_VERIFIED baselineEmptyPages=2 modifiedEmptyPages=1 counts=0/1/28/60/150 pages=1/1/1/2/4 footerEveryPage=true footerOnlyPage=false rowsPreserved=true duplicateReferenceRemoved=true portrait=true legacyEmpty=true')
# Actual application templates must contain report content, not merely a footer.
actual=[]
for p in sorted(root.glob('actual-*.pdf')):
 with pdfplumber.open(p) as doc:
  for page in doc.pages:
   text=page.extract_text() or ''
   assert len(text)>120,(p,'blank report body')
   assert 'HIDDEN-REF' not in text,(p,'reference leaked')
   assert page.width<page.height,(p,'landscape')
   assert any('TEST' in w['text'] and w['top']>page.height-45 for w in page.extract_words()),(p,'footer missing')
  actual.append({'file':p.name,'pages':len(doc.pages)})
assert len(actual)==16,len(actual)
(root/'actual-pdf-verification.json').write_text(json.dumps(actual,indent=2))
print('ACTUAL_REPORT_PDF_OK templates=16 blankReports=0 portrait=true footerBottom=true referenceRemoved=true')
