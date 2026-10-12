import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeLots} from '../lots.js';
import {assess,validateReview,parseInstrumentReport} from '../workflow.js';
import {identifyMark} from '../identify.js';
const sample=(materialId,status,sampleId='S1',lot='LOTE-1')=>({materialId,status,sampleId,lot,unit:'kg',quantity:1,flags:[],operator:'Inspector',route:materialId,morphology:'piece',planId:'SOP-IND-01',sampleTarget:2});
test('lote mixed polymer flags a hold and never certifies',()=>{
 const a=summarizeLots([sample('PET','released','S1'),sample('PVC','released','S2')])[0];
 assert.equal(a.disposition,'RETENER / REVISAR');assert.equal(a.certificate,false);
 assert.ok(a.reasons.some(x=>x.includes('diferentes')));
});
test('no lot certification even if all inspections complete',()=>{
 const a=summarizeLots([sample('PP','released','S1'),sample('PP','released','S2')])[0];
 assert.equal(a.disposition,'INSPECCIONES CERRADAS');assert.equal(a.certificate,false);
});
test('legacy samples and repeated identifiers force re-review',()=>{
 const s=summarizeLots([sample('PET','released','S1'),sample('PET','released','S1'),sample('PET','pending','')])[0];
 assert.ok(s.missingSample===1&&s.repeatedSamples===1);assert.equal(s.disposition,'RETENER / REVISAR');
});
test('imported instrument can never authorize QA of record, even legacy release route',()=>{
 const item={...sample('PP','pending'),route:'PP',instrument:{source:'instrument_import_unverified'}};
 assert.ok(validateReview(item,'Revisor 2','released','Verificación completa',true));
 assert.ok(validateReview({...item,instrument:null,sampleId:''},'Revisor 2','released','Verificación completa',true));
 assert.ok(assess({mark:identifyMark('07')}).flags.includes('RIC_07_NO_IDENTIFICA_POLIMERO'));
});
test('new risk flags retain sample',()=>{
 for(const issue of ['fire_retardant','high_moisture','unidentified_additives','unverified_mark']){
  assert.equal(assess({mark:identifyMark('05 PP'),issues:[issue]}).status,'quarantine',issue);
 }
});
test('voided samples never complete a sampling plan',()=>{
 const rows=[sample('PP','released','S1'),sample('PP','void','S2')];
 const a=summarizeLots(rows)[0];
 assert.equal(a.observedSamples,1);
 assert.equal(a.remainingSamples,1);
 assert.equal(a.disposition,'RETENER / REVISAR');
 assert.ok(a.reasons.some(r=>r.includes('Muestreo pendiente')));
});
test('case-insensitive duplicate sample IDs trigger a hold',()=>{
 const a=summarizeLots([sample('PP','released','sample-1'),sample('PP','released','SAMPLE-1')])[0];
 assert.equal(a.repeatedSamples,1);
 assert.equal(a.disposition,'RETENER / REVISAR');
});
