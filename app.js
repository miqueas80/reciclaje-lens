import {verifyEnvelope,validateTrustedKey,sha256} from './trust.js';
import {inspectSpectrum} from './spectra.js';
import {compareToReferences,validateReferenceLibrary} from './spectral-lab.js';
import {createSerialReader} from './serial.js';
import {MATERIALS,byId,byRic} from './catalog.js';
import {identifyMark} from './identify.js';
import {assess,parseInstrumentReport,validateInspection,validateReview,csvExport,STATES} from './workflow.js';
import {summarizeLots} from './lots.js';
import {createQualityReport} from './quality-report.js';
import {buildStationReport} from './station.js';
import {addInspection,getEntries,getAudit,updateStatus,exportBackup,importBackup,getSetting,setSetting} from './db.js';

const el=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stream=null,photoReady=false,installPrompt=null,markSource='manual',instrument=null,current=null,historyRows=[];
const tell=(id,message)=>el(id).textContent=message;
const values=()=>({lot:el('lot').value.trim(),sampleId:el('sampleId').value.trim(),operator:el('operator').value.trim(),origin:el('origin').value,
 quantity:Number(el('quantity').value),unit:el('unit').value,morphology:el('morphology').value,
 planId:el('planId').value.trim(),sampleTarget:Number(el('sampleTarget').value),notes:el('itemNotes').value.trim()});
const issues=()=>[...document.querySelectorAll('input[name="issue"]:checked')].map(x=>x.value);
const date=s=>{try{return new Date(s).toLocaleString('es-AR')}catch{return String(s??'')}};
const statePill=s=>`<span class="pill ${esc(s)}">${esc(STATES[s]||s)}</span>`;
function updateNetwork(){el('netLabel').textContent=navigator.onLine?'Online · núcleo local':'Sin Internet · núcleo local';el('netDot').className='dot'+(navigator.onLine?'':' off')}
window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);updateNetwork();
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('nexus-recycle-industrial'):null;
channel?.addEventListener('message',()=>refresh());
function activeTab(id){for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===id);for(const p of document.querySelectorAll('.panel'))p.classList.toggle('active',p.id===id);if(id==='qa'||id==='history'||id==='lots')refresh()}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>activeTab(b.dataset.tab);
function saveBlob(str,type,filename){const blob=new Blob([str],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}

// Visor. No hay inferencia RGB de resinas: detectamos exclusivamente texto/códigos de marcaje.
async function stopCamera(){if(stream){for(const t of stream.getTracks())t.stop();stream=null}const video=el('video');video.pause();video.srcObject=null;el('photoBtn').disabled=true;el('cameraBtn').textContent='Activar cámara'}
async function startCamera(){if(stream){await stopCamera();return}try{
 if(!navigator.mediaDevices?.getUserMedia)throw Error('Cámara disponible únicamente en HTTPS o localhost.');
 stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
 const v=el('video');v.srcObject=stream;await v.play();v.hidden=false;el('frame').hidden=true;el('emptyPreview').hidden=true;photoReady=false;el('readBtn').disabled=true;el('photoBtn').disabled=false;el('cameraBtn').textContent='Desactivar cámara';tell('visionNote','Cámara activa. Enfocá la sigla y tocá Capturar.');
 }catch(e){await stopCamera();tell('visionNote',`Cámara no disponible: ${e.message}`)}}
function drawImage(source,w,h){const c=el('frame'),ratio=Math.min(1,1600/Math.max(w,h));c.width=Math.max(1,Math.round(w*ratio));c.height=Math.max(1,Math.round(h*ratio));c.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0,c.width,c.height);el('video').hidden=true;c.hidden=false;el('emptyPreview').hidden=true;photoReady=true;el('readBtn').disabled=false}
el('cameraBtn').onclick=startCamera;
el('photoBtn').onclick=async()=>{const v=el('video');if(!stream||!v.videoWidth)return;drawImage(v,v.videoWidth,v.videoHeight);await stopCamera();tell('visionNote','Captura local guardada temporalmente en memoria. Leé o copiá la sigla.');};
el('photoFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>15*1024*1024)throw Error('Imagen mayor que 15 MB.');await stopCamera();let b=await createImageBitmap(f);drawImage(b,b.width,b.height);b.close();tell('visionNote','Fotografía cargada localmente, sin enviar datos a un servidor.');}catch(err){tell('visionNote','Error de foto: '+err.message)}finally{e.target.value=''}});
el('readBtn').onclick=async()=>{if(!photoReady)return;el('readBtn').disabled=true;tell('visionNote','Buscando un marcado legible mediante APIs locales…');try{
 const c=el('frame');let found=[];
 if('TextDetector' in globalThis){try{const t=await new TextDetector().detect(c);found=t.map(x=>x.rawValue).filter(Boolean)}catch{/* OCR de navegador no soportado */}}
 if(!found.length&&'BarcodeDetector' in globalThis){try{const d=new BarcodeDetector({formats:['qr_code','data_matrix']});const b=await d.detect(c);found=b.map(x=>x.rawValue).filter(Boolean)}catch{/* scanner no soportado */}}
 if(!found.length){tell('visionNote','No hay OCR nativo compatible o no se encontró texto. Ingresá la marca manualmente.');return}
 const text=found.join(' ').slice(0,8000);el('marking').value=text;markSource='auto';updateEval();tell('visionNote','Texto/código leído. Confirmá que pertenezca al COMPONENTE, no a una etiqueta vecina.');
 }catch(e){tell('visionNote','No se pudo procesar el marcado: '+e.message)}finally{el('readBtn').disabled=false}};

for(let n=1;n<=7;n++){const m=byRic[String(n)];const b=document.createElement('button');b.type='button';b.title=`Código ${n}, ${m.name}`;b.innerHTML=`<strong>${String(n).padStart(2,'0')}</strong><span>${esc(m.id)}</span>`;b.onclick=()=>{el('marking').value=String(n);markSource='manual';updateEval()};el('quickCodes').append(b)}
el('marking').addEventListener('input',()=>{markSource='manual';updateEval()});
el('lot').addEventListener('input',updateEval);el('sampleId').addEventListener('input',updateEval);el('morphology').addEventListener('change',updateEval);el('identifyBtn').onclick=updateEval;
for(const inp of document.querySelectorAll('input[name="issue"]'))inp.addEventListener('change',updateEval);
function updateEval(){const mark=identifyMark(el('marking').value,markSource);
 const proposed=assess({mark,instrument,issues:issues(),lot:el('lot').value.trim(),sampleId:el('sampleId').value.trim(),morphology:el('morphology').value});current={mark,instrument,assessment:proposed,source:markSource};
 const r=el('result');r.className='result '+(proposed.flags.length?'warning':'ok');
 const m=byId[proposed.materialId];const summary=m?`<div class="big"><strong>${esc(m.id)}</strong><span>${esc(m.name)}</span></div>`:'<div class="big"><strong>NO DETERMINADO</strong></div>';
 const markLine=mark.status==='identified'?`Marcado: ${esc(mark.detail)}${mark.additive?' · REFUERZOS/ADITIVOS':''}`:esc(mark.reason);
 const spectralLine=instrument?`Informe de instrumento: ${esc(instrument.method)} / ${esc(instrument.materialId)} / confianza declarada ${Math.round(instrument.confidence*100)}% <strong>(${instrument.signatureVerified?'firma de origen verificada; metrología pendiente':'origen no autenticado'})</strong>`:'Sin informe instrumental.';
 r.innerHTML=`<div class="eyebrow">EVALUACIÓN · NO LIBERACIÓN AUTOMÁTICA</div>${summary}<p>${markLine}</p><p>${spectralLine}</p><p><b>Ruta propuesta:</b> ${esc(proposed.route)}</p>${proposed.flags.length?`<p class="flag">Alertas: ${proposed.flags.map(esc).join(' · ')}</p>`:'<p class="notice">Pendiente de control por un segundo responsable.</p>'}<small>${esc(proposed.detail)}</small>`;
 el('saveBtn').disabled=false;return current;
}
const evaluate=()=>current||updateEval();
el('assessBtn').onclick=updateEval;
let trustedKeys=[];let instrumentSpectrum=null;let spectralComparison=null;
getSetting('trustedInstrumentKeys',[]).then(x=>{trustedKeys=Array.isArray(x)?x:[];renderKeys()}).catch(()=>{});
function renderKeys(){const node=el('trustedKeys');if(!node)return;node.replaceChildren();
 for(const k of trustedKeys){const line=document.createElement('div');line.className='lot-chip';line.textContent=`${k.deviceId} · ${k.keyId} · ${k.publicKey.slice(0,12)}… `;
 const b=document.createElement('button');b.className='btn secondary';b.textContent='Revocar';b.onclick=async()=>{if(!confirm('¿Revocar esta clave LOCAL? No invalida copias ya exportadas.'))return;trustedKeys=trustedKeys.filter(x=>!(x.keyId===k.keyId&&x.deviceId===k.deviceId));await setSetting('trustedInstrumentKeys',trustedKeys);renderKeys()};line.append(b);node.append(line)}
 if(!trustedKeys.length)node.textContent='No hay claves de equipos autorizadas. La importación firmada se retendrá hasta configurar una clave.';
}
el('trustKeyBtn').onclick=async()=>{try{if(!el('trustConfirm').checked)throw Error('Confirmá verificación independiente de la huella pública del fabricante.');
 const record=validateTrustedKey({keyId:el('trustedKeyId').value.trim(),deviceId:el('trustedDeviceId').value.trim(),publicKey:el('trustedPublicKey').value.trim()});
 if(trustedKeys.some(x=>x.keyId===record.keyId||x.deviceId===record.deviceId))throw Error('Key ID o equipo ya configurado. Revocá la clave anterior para rotarla.');
 trustedKeys=[...trustedKeys,record];await setSetting('trustedInstrumentKeys',trustedKeys);renderKeys();tell('trustNote','Clave registrada LOCALMENTE: el navegador no verifica por sí solo la identidad del fabricante o el responsable de planta.');
 }catch(e){tell('trustNote','Clave no registrada: '+e.message)}};
async function acceptInstrument(raw){
 let parsed;try{parsed=JSON.parse(raw)}catch{throw Error('JSON inválido')}
 if(parsed?.schema==='nexus.instrument.signed/2'){
  const v=await verifyEnvelope(parsed,trustedKeys,{lot:el('lot').value.trim(),sampleId:el('sampleId').value.trim()});
  if(!v.ok)throw Error(v.error);const report=parseInstrumentReport(v.payload);if(!report.ok)throw Error(report.error);
  const p=v.payload;const analysis=p.spectrum?inspectSpectrum(p.spectrum):null;
  if(analysis&&!analysis.ok)throw Error('Espectro incompatible: '+analysis.reason);
  instrumentSpectrum=p.spectrum||null;spectralComparison=null;
  instrument={...report.report,lot:p.lot,measurementId:p.measurementId,signatureVerified:true,keyId:v.keyId,
   signatureDigest:v.rawDigest,calibrationValidUntil:p.calibrationValidUntil,signalQA:analysis,signedEnvelope:parsed};
  tell('instrumentNote',`Firma Ed25519 válida · ${p.deviceId} · ${p.measurementId} · ${p.materialId} · ${analysis?analysis.points+' canales y '+analysis.flags.length+' alertas de señal':'sin espectro crudo'}; revisión metrológica pendiente.`);
 }else{
  const report=parseInstrumentReport(parsed);if(!report.ok)throw Error(report.error);
  instrumentSpectrum=null;spectralComparison=null;instrument=report.report;tell('instrumentNote',`Informe legacy sin firma: ${instrument.method} · ${instrument.materialId}. ORIGEN NO AUTENTICADO; retenido.`);
 }
 updateEval();return instrument;
}
el('instrumentFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;
 try{if(f.size>250*1024)throw Error('Informe mayor que 250 KB.');await acceptInstrument(await f.text())}
 catch(err){instrument=null;instrumentSpectrum=null;spectralComparison=null;tell('instrumentNote','Informe rechazado: '+err.message);updateEval()}
 finally{e.target.value=''}
});
const serialReader=createSerialReader(async line=>{try{if(line.length>250000)throw Error('Trama excesiva.');if(JSON.parse(line)?.schema!=='nexus.instrument.signed/2')throw Error('Puerto serie exige informe FIRMADO v2.');await acceptInstrument(line);tell('bridgeNote','Medición firmada recibida y revisada en memoria; guardá la inspección para registrarla.')}catch(e){tell('bridgeNote','Trama rechazada: '+e.message)}},msg=>tell('bridgeNote','Error del puerto: '+msg));
el('bridgeBtn').onclick=async()=>{try{await serialReader.connect(Number(el('serialBaud').value));tell('bridgeNote','Puerto conectado en SOLO LECTURA. Se aceptan mensajes JSON terminados en salto de línea; no hay controles de maquinaria.')}catch(e){tell('bridgeNote',e.message)}};
el('bridgeStopBtn').onclick=async()=>{await serialReader.disconnect();tell('bridgeNote','Puerto desconectado.');};
function diagnostics(){const map=[['WebCrypto',!!globalThis.crypto?.subtle],['Web Serial',!!navigator.serial],['TextDetector',!!globalThis.TextDetector],['BarcodeDetector',!!globalThis.BarcodeDetector],['IndexedDB',!!globalThis.indexedDB],['Service Worker',!!navigator.serviceWorker],['Cámara',!!navigator.mediaDevices?.getUserMedia]];
 el('edgeDiagnostic').replaceChildren();for(const [key,ok] of map){const div=document.createElement('span');div.className='lot-chip';div.textContent=(ok?'✓ ':'✕ ')+key;el('edgeDiagnostic').append(div)}}
el('edgeRefreshBtn').onclick=diagnostics;diagnostics();
let experimentalLibrary=null;
el('spectralLibraryFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{
 if(f.size>1.5*1024*1024)throw Error('Biblioteca mayor que 1.5 MB.');experimentalLibrary=validateReferenceLibrary(JSON.parse(await f.text()));
 tell('spectralLabNote',`Cargada ${experimentalLibrary.libraryId}, versión ${experimentalLibrary.version}, ${experimentalLibrary.references.length} referencias (NO VALIDADAS).`)
}catch(err){experimentalLibrary=null;tell('spectralLabNote','Biblioteca rechazada: '+err.message)}finally{e.target.value=''}});
el('compareSpectrumBtn').onclick=()=>{try{
 if(!instrument?.signalQA||!instrument?.signatureVerified)throw Error('Importá primero un informe espectral firmado, con eje y señal de la muestra.');
 const res=compareToReferences(instrumentSpectrum,experimentalLibrary);spectralComparison=res;
 tell('spectralLabNote',`RESULTADO EXPERIMENTAL, NO CERTIFICADO: ${res.ranked.map(x=>x.materialId+' (SAM '+x.angleRad.toFixed(4)+' rad)').join(' · ')}. No equivale a probabilidad, pureza ni autorización de separación.`)
}catch(err){tell('spectralLabNote','No se pudo comparar: '+err.message)}};

el('clearInstrumentBtn').onclick=()=>{instrument=null;instrumentSpectrum=null;spectralComparison=null;tell('instrumentNote','Sin informe instrumental.');updateEval()};
async function photoEvidence(){if(!photoReady)return {};
 const canvas=el('frame');const b=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.7));if(!b)return {};
 const bytes=await b.arrayBuffer();let digest='';if(globalThis.crypto?.subtle){const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));digest=[...hash].map(x=>x.toString(16).padStart(2,'0')).join('')}
 let thumbnail='';if(el('retainPhoto').checked){const tmp=document.createElement('canvas'),scale=Math.min(1,640/Math.max(canvas.width,canvas.height));tmp.width=Math.max(1,Math.round(canvas.width*scale));tmp.height=Math.max(1,Math.round(canvas.height*scale));tmp.getContext('2d').drawImage(canvas,0,0,tmp.width,tmp.height);thumbnail=tmp.toDataURL('image/jpeg',.58);if(thumbnail.length>250000)thumbnail=''}
 return {photoSHA256:digest,thumbnail};
}
el('saveBtn').onclick=async()=>{const data=values();const err=validateInspection(data);if(err){tell('saveNote',err);return}
 el('saveBtn').disabled=true;
 try{const e=evaluate();const evidence=await photoEvidence();const row={...data,...e.assessment,mark:e.mark,markSource:e.source,instrument:e.instrument,measurementId:e.instrument?.measurementId,spectralComparison,issues:issues(),...evidence};
 const record=await addInspection(row);tell('saveNote',`Muestra ${record.sampleId} registrada: ${record.id}. Estado: ${STATES[record.status]}. Evidencia disponible según captura.`);channel?.postMessage({action:'refresh'});await refresh();
 }catch(e){tell('saveNote','No se pudo guardar: '+e.message)}finally{el('saveBtn').disabled=false}};

// Catálogo de materiales, búsquedas locales; no se deduce la composición por ejemplos comerciales.
function renderCatalog(){const q=el('catalogSearch').value.trim().toUpperCase();const matches=MATERIALS.filter(m=>[m.id,m.name,m.family,m.examples,...m.aliases].join(' ').toUpperCase().includes(q));tell('countCatalog',matches.length+' materiales');const root=el('catalogGrid');root.replaceChildren();for(const m of matches){const div=document.createElement('div');div.className='material-card';div.innerHTML=`<div class="meta">${esc(m.family)} · ${m.ric!=='—'?'RIC '+esc(m.ric):'SIN RIC INDIVIDUAL'}</div><h3>${esc(m.id)} — ${esc(m.name)}</h3><p>${esc(m.examples)}</p><p><b>Ruta:</b> ${esc(m.guidance)}</p><p class="helper">${esc(m.caveat)}</p>`;root.append(div)}if(!matches.length)root.textContent='Material no encontrado. Agregar a un catálogo técnico validado; no improvisar una categoría.'}
el('catalogSearch').addEventListener('input',renderCatalog);renderCatalog();tell('catalogBadge',`${MATERIALS.length} entradas de polímeros`);

function rowSummary(row){const m=byId[row.materialId];return `<strong>${esc(row.materialId||'SIN IDENTIFICAR')} ${m?'· '+esc(m.name):''}</strong><small>Lote <b>${esc(row.lot||'Legado')}</b> · Muestra <b>${esc(row.sampleId||'SIN-ID LEGADO')}</b> · ${esc(date(row.when))} · ${esc(row.quantity||'')} ${esc(row.unit||'')} · ${esc(row.operator||'Operador no registrado')} · Formato ${esc(row.morphology||'NO DOCUMENTADO')}</small><small>Plan ${esc(row.planId||'SIN PLAN')} (${esc(row.sampleTarget??'sin objetivo')} muestras) · Ruta ${esc(row.route||'no registrada')} · Evidencia ${esc(row.source||row.evidence||'anterior')} · ID ${esc(row.id)}</small>${row.flags?.length?`<small class="flag">${row.flags.map(esc).join(' · ')}</small>`:''}`}
function renderLots(){
 const root=el('lotsList');root.replaceChildren();const summaries=summarizeLots(historyRows);tell('countLots',summaries.length+' lotes');
 if(!summaries.length){root.textContent='Sin lotes. Primero registrá muestras en Inspección.';return}
 for(const g of summaries){const card=document.createElement('article');card.className='lot-insight';
 card.innerHTML=`<div class="lot-insight-top"><div><strong>${esc(g.lot)}</strong><small>${g.total} inspecciones · ${g.kg.toFixed(3)} kg de muestras declaradas · ${g.materials.map(esc).join(', ')||'Material no determinado'}</small></div><span class="pill ${g.reasons.length?'quarantine':'pending'}">${esc(g.disposition)}</span></div><div class="lot-mini"><span>Plan: ${esc(g.planId||'NO DEFINIDO')} · Muestreo ${g.observedSamples}/${g.sampleTarget??'?'}</span><span>Formato: ${esc(g.morphologies.join(', ')||'sin registro')}</span><span>Pendientes: ${g.statuses.pending}</span><span>Cuarentena: ${g.statuses.quarantine}</span><span>Rechazadas: ${g.statuses.rejected}</span><span>Cerradas: ${g.statuses.released}</span></div><p class="helper">${esc(g.reasons.join(' · ')||'Inspecciones cerradas. Falta evaluación industrial del lote con su plan de muestreo y especificación de cliente.')}</p>`;root.append(card)}
}
function renderHistory(){const filter=el('historyFilter').value.trim().toLowerCase();const items=historyRows.filter(r=>[r.lot,r.sampleId,r.materialId,r.operator,r.id,r.status].join(' ').toLowerCase().includes(filter));tell('countHistory',items.length+' de '+historyRows.length+' registros');const root=el('historyList');root.replaceChildren();
 const lots=new Map();for(const row of items){const id=row.lot||'SIN-LOTE';if(!lots.has(id))lots.set(id,{count:0,qty:0});const v=lots.get(id);v.count++;if(row.unit==='kg')v.qty+=Number(row.quantity)||0}
 el('lotSummary').replaceChildren();for(const [id,s] of [...lots.entries()].slice(0,40)){const n=document.createElement('span');n.className='lot-chip';n.textContent=`${id} · ${s.count} insp. · ${s.qty.toFixed(2)} kg de muestras`;el('lotSummary').append(n)}
 if(!items.length){root.innerHTML='<p class="helper">Todavía no hay inspecciones coincidentes.</p>';return}
 for(const row of items){const div=document.createElement('article');div.className='history-item';div.innerHTML=`<div class="metadata">${rowSummary(row)}${row.reviewedAt?`<small>Revisó: ${esc(row.reviewedBy)} · ${esc(row.reviewReason)}</small>`:''}</div>${statePill(row.status)}`;root.append(div)}
}
el('historyFilter').addEventListener('input',renderHistory);
el('lotReportBtn').onclick=async()=>{try{
 const entries=await getEntries(),audits=await getAudit();
 if(!entries.length)throw Error('No hay inspecciones que exportar.');
 const report=await createQualityReport(entries,audits);
 saveBlob(JSON.stringify(report,null,2),'application/json','nexus-recycle-control-lotes.json');
 tell('lotReportNote',`Informe generado: ${report.lots.length} lotes, ${report.inspections.length} inspecciones; NO es un certificado.`);
 }catch(e){tell('lotReportNote',e.message)}};

function renderQA(){const root=el('qaList');root.replaceChildren();const filter=el('qaFilter').value;const pending=historyRows.filter(r=>filter==='all'||['pending','quarantine'].includes(r.status));if(!pending.length){root.innerHTML='<p class="helper">No hay inspecciones pendientes en esta vista.</p>';return}
 for(const row of pending){const card=document.createElement('article');card.className='review-card';card.innerHTML=`<div class="review-head"><div>${rowSummary(row)}</div>${statePill(row.status)}</div>`;
 if(!['pending','quarantine'].includes(row.status)){root.append(card);continue}
 const form=document.createElement('div');form.innerHTML=`<div class="qa-inputs"><div><label class="fieldlabel">Segundo responsable</label><input class="review-operator" placeholder="ID distinto al inspector" maxlength="80"></div><div><label class="fieldlabel">Motivo/documentación del control</label><input class="review-reason" placeholder="Muestra verificada, procedimiento, observación…" maxlength="500"></div></div><label class="checkline"><input type="checkbox" class="review-check"> Verifiqué físicamente el componente y comprobé las evidencias disponibles.</label><div class="actions"><button class="btn primary review-release">Cerrar inspección QA</button><button class="btn secondary review-quarantine">Retener en cuarentena</button><button class="btn danger review-reject">Rechazar</button><button class="btn secondary review-void">Anular con motivo</button></div><p class="helper review-feedback" aria-live="polite"></p>`;
 if(row.flags?.length||!row.materialId||row.materialId==='OTHER'||!row.sampleId||Boolean(row.instrument)||row.route==='CUARENTENA'||row.morphology!=='piece'||!row.planId||!row.sampleTarget)form.querySelector('.review-release').disabled=true;
 async function apply(state){const who=form.querySelector('.review-operator').value.trim(),reason=form.querySelector('.review-reason').value.trim(),checked=form.querySelector('.review-check').checked;const err=validateReview(row,who,state,reason,checked);if(err){form.querySelector('.review-feedback').textContent=err;return}
  if(state==='released'&&!confirm('Vas a CERRAR DOCUMENTALMENTE esta inspección. NO aprueba el lote, certifica el polímero ni autoriza maquinaria. ¿Confirmás el control QA?'))return;
  try{await updateStatus(row.id,who,state,reason,fresh=>validateReview(fresh,who,state,reason,checked));channel?.postMessage({action:'refresh'});await refresh();}catch(e){form.querySelector('.review-feedback').textContent=e.message}}
 for(const [cls,status] of [['review-release','released'],['review-quarantine','quarantine'],['review-reject','rejected'],['review-void','void']])form.querySelector('.'+cls).onclick=()=>apply(status);
 card.append(form);if(row.thumbnail?.startsWith('data:image/jpeg;base64,')&&row.thumbnail.length<=250000){const img=document.createElement('img');img.src=row.thumbnail;img.alt='Miniatura de evidencia de la inspección';img.loading='lazy';img.className='qa-evidence-thumbnail';card.append(img)}root.append(card);
 }
}
async function refresh(){try{historyRows=await getEntries();const total=historyRows.length;tell('kTotal',total);tell('kPending',historyRows.filter(x=>x.status==='pending').length);tell('kQuarantine',historyRows.filter(x=>x.status==='quarantine').length);tell('kReleased',historyRows.filter(x=>x.status==='released').length);renderHistory();renderQA();renderLots();}catch(e){tell('kTotal','—');tell('saveNote','No se pudo leer IndexedDB: '+e.message)}}
el('refreshQa').onclick=refresh;el('qaFilter').onchange=renderQA;
el('csvBtn').onclick=async()=>{const cols=['id','when','lot','sampleId','measurementId','materialId','route','status','origin','morphology','planId','sampleTarget','quantity','unit','operator','source','reviewedBy','reviewReason','reviewedAt','photoSHA256','notes'];saveBlob(csvExport(await getEntries(),cols),'text/csv;charset=utf-8','nexus-recycle-registros.csv')};
el('jsonBtn').onclick=async()=>saveBlob(JSON.stringify(await exportBackup(),null,2),'application/json','nexus-recycle-backup-v4-SHA256.json');
el('auditBtn').onclick=async()=>saveBlob(csvExport(await getAudit(),['id','entryId','when','action','actor','detail']),'text/csv;charset=utf-8','nexus-recycle-auditoria.csv');
el('restoreBtn').onclick=async()=>{const file=el('restoreFile').files?.[0],operator=el('restoreOperator').value.trim();if(!file){tell('restoreNote','Seleccioná un archivo JSON de copia.');return}try{if(file.size>40*1024*1024)throw Error('Respaldo mayor que 40 MB.');const json=JSON.parse(await file.text());if(!confirm('Importar registros del respaldo sin borrar los existentes?'))return;const result=await importBackup(json,operator);tell('restoreNote',`Importados y retenidos en cuarentena: ${result.imported}. Duplicados omitidos: ${result.skipped}.`);await refresh();channel?.postMessage({action:'refresh'});}catch(e){tell('restoreNote','Restauración no realizada: '+e.message)}};
el('sampleBtn').onclick=()=>saveBlob(JSON.stringify({schema:'nexus.spectrometer.result/1',method:'FTIR',materialId:'PP',confidence:0.98,deviceId:'EQUIPO-DEMO-NO-REAL',calibrationId:'CAL-DEMO',sampleId:'MUESTRA-DEMO',libraryVersion:'DEMO-1',measuredAt:new Date().toISOString(),calibratedAt:new Date().toISOString()},null,2),'application/json','nexus-formato-INSTRUMENTO-DEMO.json');
let latestStationReport=null;
el('preflightBtn').onclick=async()=>{try{
 const entries=await getEntries(),audits=await getAudit();
 latestStationReport=await buildStationReport({entries,audit:audits,trustedKeys,navigatorRef:navigator,cryptoRef:globalThis.crypto});
 const report=latestStationReport;
 el('preflightExportBtn').disabled=false;
 tell('preflightStatus',`Modo ${report.operatingMode}. Inspecciones: ${report.totals.inspections}, retenidas: ${report.totals.quarantine}, pendientes: ${report.totals.pending}. ${report.checks.map(c=>c.label+': '+(c.ok?'OK':'NO DISPONIBLE')).join(' · ')}. No certifica sensores ni proceso físico.`);
 }catch(e){latestStationReport=null;el('preflightExportBtn').disabled=true;tell('preflightStatus','Diagnóstico falló: '+e.message)}};
el('preflightExportBtn').onclick=()=>{if(latestStationReport)saveBlob(JSON.stringify(latestStationReport,null,2),'application/json','nexus-recycle-diagnostico.json')};
el('persistBtn').onclick=async()=>{try{if(!navigator.storage?.persist)throw Error('API Storage Persistence no disponible.');const ok=await navigator.storage.persist();const est=await navigator.storage.estimate?.();tell('storageMsg',`${ok?'Persistencia concedida.':'Persistencia no concedida.'}${est?.usage?` Uso ${(est.usage/1024/1024).toFixed(1)} MB.`:''} Exportá respaldos igualmente.`)}catch(e){tell('storageMsg',e.message)}};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;el('installBtn').hidden=false});el('installBtn').onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;el('installBtn').hidden=true};
window.addEventListener('pagehide',()=>{stopCamera();serialReader.disconnect()});
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(e=>tell('storageMsg','Caché no registrado: '+e.message));
getSetting('operator').then(x=>{if(x&&!el('operator').value)el('operator').value=x}).catch(()=>{});
el('operator').addEventListener('change',()=>setSetting('operator',el('operator').value.trim()).catch(()=>{}));
refresh();updateEval();
