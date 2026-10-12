import test from 'node:test';
import assert from 'node:assert/strict';
import {assess,validateInspection,validateReview} from '../workflow.js';
import {identifyMark} from '../identify.js';
import {summarizeLots} from '../lots.js';
const mark=identifyMark('05 PP');
const row=(id, extra={})=>({lot:'L-IND',sampleId:id,operator:'Inspector',materialId:'PP',status:'released',unit:'kg',quantity:0.2,flags:[],route:'PP',morphology:'piece',planId:'SOP-IND-01',sampleTarget:3,...extra});
for(const mode of ['film','flake','pellet','powder','mixed']){
 test(`marcado de ${mode} nunca identifica material ni ruta comercial`,()=>{
  const a=assess({mark,morphology:mode});
  assert.equal(a.status,'quarantine');assert.equal(a.materialId,null);assert.equal(a.route,'CUARENTENA');
  assert.ok(a.flags.includes('MARCA_NO_VINCULABLE_A_PIEZA'));
  assert.ok(validateReview({...row('M-01',{...a,morphology:mode,status:'quarantine'})},'Revisor','released','Control completamente realizado',true));
 });
}
test('pieza íntegra permite solo cierre documental QA con segundo responsable y plan',()=>{
 const a=assess({mark,morphology:'piece'});
 assert.equal(a.route,'PP');
 assert.equal(validateReview({...row('M-01',{...a,status:'pending'})},'Revisor','released','Marcado físicamente confirmado',true),null);
 assert.ok(validateReview({...row('M-01',{...a,planId:null,status:'pending'})},'Revisor','released','Marcado físicamente confirmado',true));
});
test('muestreo incompleto y cobertura del lote detectados',()=>{
 const a=summarizeLots([row('M1'),row('M2')])[0];
 assert.equal(a.sampleTarget,3);assert.equal(a.observedSamples,2);assert.equal(a.remainingSamples,1);
 assert.equal(a.disposition,'RETENER / REVISAR');assert.equal(a.certificate,false);
});
test('cobertura declarada NO certifica lote',()=>{
 const a=summarizeLots([row('M1'),row('M2'),row('M3')])[0];
 assert.equal(a.disposition,'INSPECCIONES CERRADAS');assert.equal(a.certificate,false);
});
test('lote con planes incompatibles se retiene',()=>{
 const a=summarizeLots([row('M1'),row('M2',{sampleTarget:6,planId:'SOP-IND-02'})])[0];
 assert.equal(a.disposition,'RETENER / REVISAR');
 assert.ok(a.reasons.some(r=>r.includes('Plan de muestreo')));
});
test('no se admiten muestras sin identificador de SOP y objetivo definido',()=>{
 const base={lot:'L-001',sampleId:'S-01',operator:'Op Test',origin:'industrial',quantity:1,unit:'kg',notes:'',morphology:'flake',planId:'SOP-IND-02',sampleTarget:12};
 assert.equal(validateInspection(base),null);
 for(const change of [{planId:''},{sampleTarget:0},{sampleTarget:2.3},{morphology:'unknown'}])assert.ok(validateInspection({...base,...change}));
});
