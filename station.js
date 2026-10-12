import {summarizeLots} from './lots.js';
/** Autoinspección de estación. Una API disponible NO prueba un instrumento calibrado. */
export async function buildStationReport({entries=[],audit=[],trustedKeys=[],navigatorRef={},cryptoRef=globalThis.crypto,now=new Date().toISOString()}={}){
 const checks=[];
 const add=(label,ok,note)=>checks.push({label,ok:Boolean(ok),note});
 add('WebCrypto',!!cryptoRef?.subtle,'Las firmas necesitan WebCrypto y HTTPS.');
 add('IndexedDB',typeof indexedDB!=='undefined','La lectura correcta de los registros se comprobó antes de ejecutar el diagnóstico.');
 add('Service Worker',!!navigatorRef.serviceWorker,'La disponibilidad de la API no garantiza caché offline.');
 let swControlled=false;
 if(navigatorRef.serviceWorker){
  try{const reg=await navigatorRef.serviceWorker.getRegistration?.();swControlled=Boolean(navigatorRef.serviceWorker.controller&&reg?.active)}catch{}
 }
 add('PWA activa',swControlled,'Requiere recargar después del primer registro del Service Worker.');
 let persisted=null,storageBytes=null,quotaBytes=null;
 try{persisted=typeof navigatorRef.storage?.persisted==='function'?await navigatorRef.storage.persisted():null}catch{}
 try{if(navigatorRef.storage?.estimate){const e=await navigatorRef.storage.estimate();storageBytes=Number.isFinite(e?.usage)?e.usage:null;quotaBytes=Number.isFinite(e?.quota)?e.quota:null}}catch{}
 add('Almacenamiento persistente',persisted===true,'Persistencia reduce riesgo de eliminación automática, no sustituye backups externos.');
 add('Puerto USB/serie',!!navigatorRef.serial,'Requiere navegador y espectrómetro compatibles; no significa instrumento conectado.');
 const rows=Array.isArray(entries)?entries:[],events=Array.isArray(audit)?audit:[];
 const linked=new Set(events.map(e=>e.entryId));
 const lackingAudit=rows.filter(r=>!linked.has(r.id)).length;
 const lotSummaries=summarizeLots(rows);
 const unresolved=lotSummaries.filter(l=>l.disposition!=='INSPECCIONES CERRADAS');
 const important=[
  ...(!swControlled?['La operación offline completa aún no está verificada en esta sesión.']:[]),
  ...(persisted!==true?['Persistencia de almacenamiento no concedida o no verificable.']:[]),
  ...(lackingAudit?[`${lackingAudit} inspecciones sin evento de auditoría local vinculado.`]:[]),
  ...(unresolved.length?[`${unresolved.length} lotes requieren revisión o muestreo adicional.`]:[]),
 ];
 return {schema:'nexus.recycle.station-diagnostic/1',generatedAt:now,
  operatingMode:'PILOTO_SUPERVISADO',productionCertification:false,
  canProveChemicalIdentity:false,canActuateMachinery:false,
  checks,totals:{inspections:rows.length,auditEvents:events.length,lots:lotSummaries.length,
   pending:rows.filter(r=>r.status==='pending').length,quarantine:rows.filter(r=>r.status==='quarantine').length,
   closedQA:rows.filter(r=>r.status==='released').length,withoutAuditEvent:lackingAudit},
  instrumentKeysConfigured:trustedKeys.length,storage:{persisted,usageBytes:storageBytes,quotaBytes},
  criticalAlerts:important,note:'Autodiagnóstico del software local, NO aceptación metrológica, certificación de lote ni habilitación de línea.'};
}
