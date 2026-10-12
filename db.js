import {manifestForBackup,checkManifest} from './trust.js';
const DATABASE='nexus-recycle-lens-v1';
const VERSION=5;
let ready;
function db(){
 if(ready)return ready;
 ready=new Promise((resolve,reject)=>{
  if(!('indexedDB' in globalThis)){reject(new Error('IndexedDB no disponible'));return}
  const req=indexedDB.open(DATABASE,VERSION);
  req.onupgradeneeded=event=>{
   const d=req.result;
   if(!d.objectStoreNames.contains('entries'))d.createObjectStore('entries',{keyPath:'id'});
   const entryStore=req.transaction.objectStore('entries');
   if(!entryStore.indexNames.contains('byLotSample'))entryStore.createIndex('byLotSample',['lot','sampleId'],{unique:false});
   if(!entryStore.indexNames.contains('byLot'))entryStore.createIndex('byLot','lot',{unique:false});
   if(!entryStore.indexNames.contains('byMeasurement'))entryStore.createIndex('byMeasurement','measurementId',{unique:true});
   if(!d.objectStoreNames.contains('audit')){const s=d.createObjectStore('audit',{keyPath:'id'});s.createIndex('entryId','entryId');}
   if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'key'});
   // Inspecciones antiguas del prototipo no traían control QA: migrar a cuarentena.
   if(event.oldVersion<2 && req.transaction && d.objectStoreNames.contains('entries')){
    const rows=req.transaction.objectStore('entries');
    rows.openCursor().onsuccess=event=>{
     const cur=event.target.result;if(!cur)return;
     const row=cur.value;
     if(!row.status){
      row.status='quarantine';row.flags=['LEGACY_SIN_QA'];row.route='CUARENTENA';row.source='marcado_prototipo';row.revision=1;
      row.lot=row.lot||'LEGACY-IMPORTADO';row.operator=row.operator||'Migración desde prototipo';
      cur.update(row);
      req.transaction.objectStore('audit').add({id:newid(),entryId:row.id,when:new Date().toISOString(),action:'LEGACY_MIGRATION',actor:'Sistema',detail:'Registro anterior sin QA retenido en cuarentena'});
     }
     cur.continue();
    };
   }
  };
  req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result)};
  req.onerror=()=>reject(req.error||new Error('No se puede abrir la base'));
  req.onblocked=()=>reject(new Error('Cerrá otras pestañas antiguas para actualizar el almacenamiento.'));
 });return ready;
}
const newid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
function perform(stores,mode,fn){return db().then(d=>new Promise((resolve,reject)=>{
 const tx=d.transaction(stores,mode);let out;
 try{out=fn(tx)}catch(e){tx.abort();reject(e);return}
 tx.oncomplete=()=>resolve(out);
 tx.onerror=()=>reject(tx.error||new Error('Transacción fallida'));
 tx.onabort=()=>reject(tx.error||new Error('Transacción cancelada'));
}));}
function audit(entryId,action,actor,detail){return {id:newid(),entryId,when:new Date().toISOString(),action,actor,detail}}
export async function addInspection(row){
 const record={...row,id:newid(),when:new Date().toISOString(),status:row.status||'pending',revision:1};
 const d=await db();
 await new Promise((resolve,reject)=>{
  const tx=d.transaction(['entries','audit'],'readwrite');
  const store=tx.objectStore('entries');
  const req=store.index('byLot').getAll(record.lot);
  let reason=null;
  req.onsuccess=()=>{
   const matches=req.result||[];
   if(matches.some(r=>r.sampleId?.toUpperCase()===record.sampleId.toUpperCase())){reason='Ya existe la muestra '+record.sampleId+' en el lote '+record.lot+'. Utilizá otro identificador o revisá Registros.';tx.abort();return;}
   if(matches.some(r=>!r.planId||!r.sampleTarget||!r.morphology)){reason='Este lote contiene registros anteriores sin plan o formato. Creá un lote nuevo para evitar mezclar evidencia no trazable.';tx.abort();return;}
   if(matches.some(r=>r.planId!==record.planId||r.sampleTarget!==record.sampleTarget)){reason='El plan o cantidad objetivo no coincide con las otras inspecciones del lote.';tx.abort();return;}
   if(record.measurementId){const m=store.index('byMeasurement').get(record.measurementId);m.onsuccess=()=>{if(m.result){reason='Medición instrumental repetida: '+record.measurementId;tx.abort();return}store.add(record);tx.objectStore('audit').add(audit(record.id,'CREATED',row.operator,`Lote ${row.lot} · muestra ${row.sampleId} · inspección creada`));};return;}
   store.add(record);tx.objectStore('audit').add(audit(record.id,'CREATED',row.operator,`Lote ${row.lot} · muestra ${row.sampleId} · inspección creada`));
  };
  tx.oncomplete=resolve;
  tx.onerror=()=>reject(tx.error||new Error('Error al guardar inspección'));
  tx.onabort=()=>reject(new Error(reason||'No se pudo guardar la muestra (transacción cancelada)'));
 });
 return record;
}
export async function updateStatus(id,operator,nextState,reason,validate){
 const d=await db();return new Promise((resolve,reject)=>{
  const tx=d.transaction(['entries','audit'],'readwrite');const store=tx.objectStore('entries');let updated;
  const req=store.get(id);
  req.onsuccess=()=>{
   const previous=req.result;
   if(!previous){tx.abort();reject(new Error('Registro no encontrado'));return}
   const error=validate(previous);
   if(error){tx.abort();reject(new Error(error));return}
   updated={...previous,status:nextState,reviewedBy:operator,reviewReason:reason,reviewedAt:new Date().toISOString(),revision:(previous.revision||1)+1};
   store.put(updated);
   tx.objectStore('audit').add(audit(id,'STATE_'+nextState.toUpperCase(),operator,`${previous.status} → ${nextState} · ${reason}`));
  };
  tx.oncomplete=()=>resolve(updated);
  tx.onerror=()=>reject(tx.error||new Error('Error al actualizar'));
  tx.onabort=()=>reject(tx.error||new Error('No se pudo modificar el registro'));
 });
}
function list(storeName){return db().then(d=>new Promise((resolve,reject)=>{const r=d.transaction(storeName).objectStore(storeName).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}));}
export async function getEntries(){return (await list('entries')).sort((a,b)=>(b.when||'').localeCompare(a.when||''))}
export async function getAudit(){return (await list('audit')).sort((a,b)=>(b.when||'').localeCompare(a.when||''))}
export async function getSetting(key,fallback=''){const d=await db();return new Promise((res,rej)=>{const r=d.transaction('settings').objectStore('settings').get(key);r.onsuccess=()=>res(r.result?.value??fallback);r.onerror=()=>rej(r.error)});}
export async function setSetting(key,value){return perform(['settings'],'readwrite',tx=>tx.objectStore('settings').put({key,value}));}
export async function exportBackup(){const records=await getEntries(),audit=await getAudit();return {format:'nexus.recycle.backup',version:4,generatedAt:new Date().toISOString(),records,audit,integrity:await manifestForBackup(records,audit)};}
export async function importBackup(payload,operator){
 if(payload?.format!=='nexus.recycle.backup'||![2,3,4].includes(payload.version)||!Array.isArray(payload.records)||!Array.isArray(payload.audit)||payload.records.length>100000||payload.audit.length>500000)throw Error('Backup incompatible o demasiado grande.');
 if(payload.version===4&&!(await checkManifest(payload)))throw Error('Respaldo alterado o resumen SHA-256 inválido (integridad no garantizada).');
 if(!operator||operator.trim().length<3)throw Error('Identificá al responsable de la restauración.');
 const ids=new Set(),eventIds=new Set(),lotSamples=new Set(),measurements=new Set();
 for(const row of payload.records){if(!row||typeof row.id!=='string'||row.id.length>120||typeof row.when!=='string'||!row.status||ids.has(row.id))throw Error('Backup de registros inválido/duplicado');ids.add(row.id);if(row.sampleId){const key=row.lot+'\u0000'+row.sampleId;if(lotSamples.has(key))throw Error('Respaldo con muestra duplicada dentro de un lote');lotSamples.add(key)}if(row.measurementId){if(measurements.has(row.measurementId))throw Error('Medición duplicada en el respaldo');measurements.add(row.measurementId)}}
 for(const ev of payload.audit){if(!ev||typeof ev.id!=='string'||!ids.has(ev.entryId)||eventIds.has(ev.id))throw Error('Backup de auditoría inválido/duplicado');eventIds.add(ev.id)}
 const existing=new Set((await getEntries()).map(x=>x.id));
 const current=await getEntries();const occupied=new Set(current.filter(x=>x.sampleId).map(x=>x.lot+'\u0000'+x.sampleId));
 const occupiedMeasurements=new Set(current.map(x=>x.measurementId).filter(Boolean));
 const available=payload.records.filter(x=>!existing.has(x.id));
 for(const row of available)if(row.sampleId&&occupied.has(row.lot+'\u0000'+row.sampleId))throw Error('Restauración bloqueada: muestra '+row.sampleId+' ya existe en lote '+row.lot+'. No se mezclaron inspecciones.');
 for(const row of available)if(row.measurementId&&occupiedMeasurements.has(row.measurementId))throw Error('Medición ya importada: '+row.measurementId);
 if(!available.length)return {imported:0,skipped:payload.records.length};
 const keepIds=new Set(available.map(x=>x.id));
 // Una sola transacción: los registros y su auditoría se importan juntos o no se importa nada.
 await perform(['entries','audit'],'readwrite',tx=>{
  const s=tx.objectStore('entries'),a=tx.objectStore('audit');
  for(const row of available)s.add({...row,status:'quarantine',route:'CUARENTENA',flags:[...new Set([...(Array.isArray(row.flags)?row.flags:[]),'BACKUP_RESTAURADO_SIN_AUTENTICIDAD'])],reviewedBy:null,reviewedAt:null,reviewReason:null,revision:(row.revision||1)+1});
  for(const ev of payload.audit.filter(e=>keepIds.has(e.entryId)))a.add({...ev,id:newid(),sourceAuditId:ev.id});
  for(const row of available)a.add(audit(row.id,'BACKUP_IMPORT_RETAINED',operator,'Restaurado en cuarentena: archivo JSON sin firma de autoridad y sin autenticación independiente'));
 });
 return {imported:available.length,skipped:payload.records.length-available.length};
}
