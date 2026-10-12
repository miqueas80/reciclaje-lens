import {summarizeLots} from './lots.js';
import {sha256,stableJSON} from './trust.js';
/** QA report: traceability snapshot, NEVER a certificate or authorization for sorting machinery.
 * The checksum detects accidental changes but does not prove authorship.
 */
export async function createQualityReport(entries,audit,{generatedAt=new Date().toISOString()}={}){
 if(!Array.isArray(entries)||!Array.isArray(audit))throw Error('Registros y auditoría requeridos.');
 const summaries=summarizeLots(entries);
 const inspectionList=entries.map(r=>({
  id:r.id,lot:r.lot,sampleId:r.sampleId,measurementId:r.measurementId||null,
  materialId:r.materialId||null,morphology:r.morphology||null,planId:r.planId||null,
  sampleTarget:r.sampleTarget??null,source:r.source||null,
  instrumentSource:r.instrument?.source||null,
  instrumentSigned:Boolean(r.instrument?.signatureVerified),
  instrumentKeyId:r.instrument?.keyId||null,
  instrumentPayloadDigest:r.instrument?.signatureDigest||null,
  status:r.status,route:r.route,flags:r.flags||[],inspectedAt:r.when,
  inspector:r.operator,reviewer:r.reviewedBy||null,reviewedAt:r.reviewedAt||null,
  photoSHA256:r.photoSHA256||null,
 }));
 const audits=audit.map(a=>({id:a.id,entryId:a.entryId,when:a.when,action:a.action,actor:a.actor,detail:a.detail}));
 const body={schema:'nexus.recycle.lot-control/1',generatedAt,
  intendedUse:'SOP/QA documental. NO CERTIFICACION, NI ACEPTACION DE LOTE, NI COMANDO DE ACTUADOR',
  lotApprovalAuthority:false,chemicalIdentificationCertified:false,physicalActuationPermitted:false,
  lots:summaries,inspections:inspectionList,audit:audits};
 const portable=JSON.parse(JSON.stringify(body)); // El hash cubre exactamente los bytes lógicos que sobreviven al JSON exportado.
 return {...portable,integrity:{algorithm:'SHA-256',hash:await sha256(stableJSON(portable)),authentication:'NONE: el hash no equivale a firma digital'}};
}
export async function verifyQualityReport(report){
 if(!report||report.schema!=='nexus.recycle.lot-control/1'||report.integrity?.algorithm!=='SHA-256'||typeof report.integrity.hash!=='string')return false;
 const {integrity,...body}=report;
 return await sha256(stableJSON(body))===integrity.hash;
}
