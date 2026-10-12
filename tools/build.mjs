import {readFileSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const sw=readFileSync(join(root,'sw.js'),'utf8');
const m=sw.match(/const ASSETS=\[(.*?)\];/s);
if(!m)throw Error('No se detectó la lista de assets del Service Worker.');
const files=[...new Set([...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]).filter(x=>x!=='./').concat(['sw.js']))];
const dist=join(root,'dist');rmSync(dist,{recursive:true,force:true});mkdirSync(dist,{recursive:true});
for(const relative of files){const out=join(dist,relative);mkdirSync(dirname(out),{recursive:true});copyFileSync(join(root,relative),out)}
writeFileSync(join(dist,'.nojekyll'),'');
console.log(`Static build: ${files.length} archivos para GitHub Pages, en dist/. Sin CDN, servidor ni secretos.`);
