"""Prueba de interfaz en navegador headless con base de datos simulada.
No es una prueba de IndexedDB/Service Worker real; usa about:blank por política de red.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
base=Path(__file__).resolve().parent.parent
html=(base/'index.html').read_text()
# La simulación usa un CSS inline inyectado por Playwright, así que se omite la CSP solo en el harness.
html=re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]+">','',html)
html=html.replace('<link rel="stylesheet" href="./styles.css">','<style>'+(base/'styles.css').read_text()+'</style>')
mock='''
let mockRows=[],mockAudit=[];
async function addInspection(row){const item={...row,id:'rec'+(mockRows.length+1),when:new Date().toISOString(),revision:1};mockRows.push(item);return item}
async function getEntries(){return [...mockRows].reverse()}
async function getAudit(){return mockAudit}
async function updateStatus(id,operator,state,reason,validate){const row=mockRows.find(x=>x.id===id),error=validate(row);if(error)throw Error(error);row.status=state;row.reviewedBy=operator;row.reviewReason=reason;row.reviewedAt=new Date().toISOString();return row}
async function exportBackup(){return {format:'nexus.recycle.backup',version:3,records:mockRows,audit:mockAudit}}
async function importBackup(){return {imported:0,skipped:0}}
async function getSetting(){return ''}
async function setSetting(){}
'''
code=[]
for file in ['catalog.js','identify.js','workflow.js','lots.js','trust.js','spectra.js','spectral-lab.js','serial.js','quality-report.js','station.js']:
    s=(base/file).read_text()
    s=re.sub(r'^import[^\n]*\n','',s,flags=re.M)
    s=re.sub(r'\bexport\s+(?=(const|function|async function|class)\b)','',s)
    code.append(s)
code.append(mock)
s=(base/'app.js').read_text()
s=re.sub(r'^import[^\n]*\n','',s,flags=re.M)
code.append(s)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1200,'height':900})
    errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(html)
    pg.evaluate('''() => {return true}''')
    pg.evaluate('(code) => {eval(code)}','\n'.join(code))
    assert pg.locator('#quickCodes button').count()==7
    assert pg.locator('#countCatalog').inner_text().startswith('57')
    pg.locator('#lot').fill('LOT-123')
    pg.locator('#planId').fill('SOP-IND-01')
    pg.locator('#sampleTarget').fill('2')
    pg.locator('#operator').fill('Operador uno')
    pg.locator('#sampleId').fill('M-001')
    pg.locator('#marking').fill('05 PP')
    assert 'PP' in pg.locator('#result').inner_text()
    pg.locator('#saveBtn').click()
    pg.wait_for_function("document.querySelector('#kTotal').textContent === '1'")
    pg.locator('[data-tab="qa"]').click()
    pg.locator('.review-operator').first.fill('Operador dos')
    pg.locator('.review-reason').first.fill('Revisión controlada muestra 123')
    pg.locator('.review-check').first.check()
    pg.on('dialog',lambda d:d.accept())
    pg.locator('.review-release').first.click()
    pg.wait_for_function("document.querySelector('#kReleased').textContent === '1'")
    pg.locator('[data-tab="scan"]').click()
    pg.locator('#marking').fill('>PC+ABS<')
    pg.locator('#sampleId').fill('M-002')
    assert 'CUARENTENA' in pg.locator('#result').inner_text()
    pg.locator('#saveBtn').click()
    pg.wait_for_function("document.querySelector('#kTotal').textContent === '2'")
    assert pg.locator('#kQuarantine').inner_text()=='1'
    pg.locator('[data-tab="lots"]').click()
    assert 'RETENER / REVISAR' in pg.locator('#lotsList').inner_text()
    pg.locator('[data-tab="edge"]').click()
    assert pg.locator('#edgeDiagnostic .lot-chip').count() >= 6
    assert pg.locator('#trustedKeys').inner_text().startswith('No hay claves')
    pg.locator('[data-tab="history"]').click()
    assert pg.locator('.history-item').count()==2
    pg.locator('[data-tab="lots"]').click()
    assert pg.locator('#lotReportBtn').count()==1
    pg.locator('[data-tab="about"]').click()
    pg.locator('#preflightBtn').click()
    pg.wait_for_function("document.querySelector('#preflightExportBtn').disabled === false")
    assert 'PILOTO_SUPERVISADO' in pg.locator('#preflightStatus').inner_text()
    pg.screenshot(path=str(base/'preview-v3.1-tested.png'),full_page=True)
    pg.set_viewport_size({'width':390,'height':844})
    pg.screenshot(path=str(base/'preview-v3.1-mobile.png'),full_page=True)
    viewport=pg.evaluate('''() => ({scrollWidth:document.documentElement.scrollWidth, viewport:window.innerWidth})''')
    assert viewport['scrollWidth']<=viewport['viewport']+4,viewport
    print('UI headless with DB mocked: PASS; pageerrors:',errs)
    assert not errs,errs
    b.close()
