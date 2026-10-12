/** Firma de origen industrial (Ed25519). Una firma válida NO certifica precisión metrológica. */
const enc = new TextEncoder();
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
export function stableJSON(value) {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stableJSON).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJSON(value[k])).join(',')+'}';
}
export function base64ToBytes(s){
 if(typeof s!=='string'||!s||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw Error('Base64 inválido.');
 if(typeof atob==='function')return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 return new Uint8Array(Buffer.from(s,'base64'));
}
export function bytesToBase64(bytes){if(typeof btoa==='function')return btoa(String.fromCharCode(...bytes));return Buffer.from(bytes).toString('base64')}
export async function sha256(value){const bytes=typeof value==='string'?enc.encode(value):value;const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function validateTrustedKey(o){
 if(!o||!idPattern.test(o.keyId||'')||!idPattern.test(o.deviceId||''))throw Error('Clave: keyId y deviceId deben tener 3–80 caracteres válidos.');
 const raw=base64ToBytes(o.publicKey);if(raw.length!==32)throw Error('La clave pública Ed25519 debe tener 32 bytes.');
 return {keyId:o.keyId,deviceId:o.deviceId,publicKey:o.publicKey,addedAt:new Date().toISOString()};
}
export function parseEnvelope(value){
 let o;try{o=typeof value==='string'?JSON.parse(value):value}catch{throw Error('JSON del instrumento inválido.')}
 if(!o||typeof o!=='object'||Array.isArray(o)||o.schema!=='nexus.instrument.signed/2')throw Error('Esquema firmado v2 requerido.');
 if(!o.payload||typeof o.payload!=='object'||Array.isArray(o.payload)||!o.signature||typeof o.signature!=='object')throw Error('Falta payload o firma.');
 if(o.signature.algorithm!=='Ed25519'||!idPattern.test(o.signature.keyId||''))throw Error('Algoritmo o identificador de clave incompatible.');
 if(base64ToBytes(o.signature.value).length!==64)throw Error('Firma Ed25519 de 64 bytes obligatoria.');
 const p=o.payload;
 for(const k of ['lot','sampleId','measurementId'])if(!idPattern.test(p[k]||''))throw Error(`Identificador ${k} inválido.`);
 if(Object.keys(o).some(k=>!['schema','payload','signature'].includes(k)))throw Error('Campos extra en sobre firmado.');
 return o;
}
export async function verifyEnvelope(source,trustedKeys,{lot,sampleId,now=Date.now()}={}){
 try{
  if(!globalThis.crypto?.subtle)throw Error('WebCrypto no disponible: usar HTTPS/localhost.');
  const o=parseEnvelope(source),p=o.payload;
  // La fecha y validez de calibración declaradas proceden del emisor; NO equivalen a acreditación.
  const checkDate=x=>{const n=Date.parse(x);return Number.isFinite(n)?n:NaN};
  const t=checkDate(p.measuredAt),cal=checkDate(p.calibratedAt),until=checkDate(p.calibrationValidUntil);
  if(!Number.isFinite(t)||!Number.isFinite(cal)||!Number.isFinite(until)||t>now+5*60000||t<now-7*86400000)throw Error('Medición fuera de ventana operativa de 7 días.');
  if(cal>t||until<t||until<cal)throw Error('Calibración declarada inválida o vencida.');
  if(lot&&p.lot!==lot)throw Error('El lote firmado no coincide con la inspección.');
  if(sampleId&&p.sampleId!==sampleId)throw Error('La muestra firmada no coincide con la inspección.');
  const match=(trustedKeys||[]).find(k=>k.keyId===o.signature.keyId&&k.deviceId===p.deviceId);
  if(!match)throw Error('Equipo/clave no autorizados en esta estación.');
  const key=await crypto.subtle.importKey('raw',base64ToBytes(match.publicKey),{name:'Ed25519'},false,['verify']);
  const ok=await crypto.subtle.verify('Ed25519',key,base64ToBytes(o.signature.value),enc.encode(stableJSON(p)));
  if(!ok)throw Error('Firma inválida: contenido alterado o clave incorrecta.');
  return {ok:true,payload:p,keyId:o.signature.keyId,signatureVerified:true,rawDigest:await sha256(stableJSON(p)),note:'Origen e integridad verificados por clave local; no certifica calibración, muestreo ni polímero.'};
 }catch(e){return {ok:false,error:e.message||'Error de validación de firma'}}
}
export async function manifestForBackup(rows,audit){return {algorithm:'SHA-256',recordsHash:await sha256(stableJSON(rows)),auditHash:await sha256(stableJSON(audit))}}
export async function checkManifest(payload){if(!payload.integrity||payload.integrity.algorithm!=='SHA-256')return false;const m=await manifestForBackup(payload.records,payload.audit);return m.recordsHash===payload.integrity.recordsHash&&m.auditHash===payload.integrity.auditHash}
