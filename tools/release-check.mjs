import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const fail=m=>{throw Error('RELEASE CHECK: '+m)};
const read=f=>readFileSync(join(root,f),'utf8');
const sw=read('sw.js'),html=read('index.html'),manifest=JSON.parse(read('manifest.webmanifest'));
const match=sw.match(/const ASSETS=\[(.*?)\];/s);
if(!match)fail('Lista de precache no detectada.');
const assets=[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
for(const a of assets){if(!existsSync(join(root,a)))fail('Asset de PWA ausente: '+a)}
for(const required of ['./app.js','./db.js','./trust.js','./quality-report.js','./station.js','./catalog.js','./index.html'])if(!assets.includes(required))fail('Archivo funcional fuera de PWA: '+required);
if(!sw.includes('v3.1.0'))fail('Cache viejo.');
if(!html.includes('Content-Security-Policy')||!html.includes("script-src 'self'")||!html.includes("object-src 'none'"))fail('CSP faltante o insegura.');
if(!html.includes('lotReportBtn')||!html.includes('preflightBtn'))fail('UI de cierre faltante.');
if(!manifest.icons?.every(icon=>existsSync(join(root,icon.src))))fail('Iconos PWA incompletos.');
const modules=['app.js','catalog.js','db.js','identify.js','lots.js','quality-report.js','serial.js','spectra.js','spectral-lab.js','station.js','trust.js','workflow.js','sw.js'];
for(const m of modules)execFileSync(process.execPath,['--check',join(root,m)],{stdio:'pipe'});
for(const m of modules){const content=read(m);for(const hit of content.matchAll(/\bfrom\s*['"](\.\/.+?\.js)['"]/g))if(!existsSync(join(root,hit[1])))fail(`Import roto ${m} -> ${hit[1]}`)}
const dist=join(root,'dist');
if(!existsSync(join(dist,'sw.js')))fail('El Service Worker no está incluido en la compilación de publicación.');
for(const a of assets.filter(a=>a!=='./'))if(!existsSync(join(dist,a)))fail('Archivo PWA faltante en dist: '+a);
if(!readFileSync(join(dist,'sw.js'),'utf8').includes('caches.open'))fail('Service Worker incorrecto en dist.');
console.log(`RELEASE CHECK PASS: ${assets.length} assets PWA, ${modules.length} módulos JS válidos, CSP y referencias locales.`);
