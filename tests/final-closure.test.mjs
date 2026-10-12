import test from 'node:test';
import assert from 'node:assert/strict';
import {createQualityReport,verifyQualityReport} from '../quality-report.js';
import {buildStationReport} from '../station.js';
const mk=(status='quarantine')=>({id:'REC-1',lot:'LOT-1',sampleId:'S1',sampleTarget:2,planId:'SOP-11',morphology:'flake',materialId:'PET',status,route:'CUARENTENA',operator:'Inspector 1',flags:['METROLOGIA_NO_VALIDADA'],when:'2026-10-10T10:00:00Z',instrument:{signatureVerified:true,source:'instrumento_firma_verificada_sin_certificado',keyId:'EQUIPO-01',signatureDigest:'abcd'}});
test('quality report contains linked evidence, not a certificate',async()=>{
 const data=await createQualityReport([mk()],[{id:'AU-1',entryId:'REC-1',action:'CREATED',when:'2026-10-10T10:00:00Z',actor:'Inspector 1'}]);
 assert.equal(data.lots.length,1);
 assert.equal(data.lots[0].disposition,'RETENER / REVISAR');
 assert.equal(data.lotApprovalAuthority,false);
 assert.equal(data.physicalActuationPermitted,false);
 assert.equal(data.inspections[0].instrumentSigned,true);
 assert.equal(await verifyQualityReport(data),true);
 assert.equal(await verifyQualityReport(JSON.parse(JSON.stringify(data))),true);
});
test('tampered reports cannot pass integrity check',async()=>{
 const data=await createQualityReport([mk()],[]);
 data.inspections[0].status='released';
 assert.equal(await verifyQualityReport(data),false);
});
test('invalid QA export inputs rejected',async()=>{
 await assert.rejects(createQualityReport(null,[]));
 await assert.rejects(createQualityReport([],null));
 assert.equal(await verifyQualityReport({schema:'wrong'}),false);
});
test('station preflight fail-closed on missing interfaces and unaudited records',async()=>{
 const s=await buildStationReport({entries:[mk()],audit:[],navigatorRef:{},trustedKeys:[{keyId:'x'}]});
 assert.equal(s.operatingMode,'PILOTO_SUPERVISADO');
 assert.equal(s.canActuateMachinery,false);
 assert.equal(s.canProveChemicalIdentity,false);
 assert.equal(s.instrumentKeysConfigured,1);
 assert.equal(s.totals.withoutAuditEvent,1);
 assert.ok(s.criticalAlerts.some(a=>a.includes('sin evento')));
 assert.ok(s.checks.some(c=>c.label==='PWA activa'&&!c.ok));
});
test('preflight inspects storage and PWA without certifying metrology',async()=>{
 const s=await buildStationReport({
  entries:[mk('released')],audit:[{entryId:'REC-1'}],
  navigatorRef:{storage:{persisted:async()=>true,estimate:async()=>({usage:512,quota:4096})},serviceWorker:{controller:{},getRegistration:async()=>({active:{}})},serial:{}},
 });
 assert.ok(s.checks.some(c=>c.label==='Almacenamiento persistente'&&c.ok));
 assert.ok(s.checks.some(c=>c.label==='PWA activa'&&c.ok));
 assert.equal(s.storage.usageBytes,512);
 assert.equal(s.productionCertification,false);
});
