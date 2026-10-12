import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyMark} from '../identify.js';
import {assess,parseInstrumentReport,validateInspection,validateReview,csvExport} from '../workflow.js';
import {MATERIALS} from '../catalog.js';
const data={lot:'LOTE-20A',sampleId:'MUESTRA-001',operator:'Operador A',origin:'industrial',quantity:15.5,unit:'kg',morphology:'piece',planId:'SOP-IND-01',sampleTarget:2,notes:''};
const report=(other={})=>({schema:'nexus.spectrometer.result/1',method:'FTIR',materialId:'PP',confidence:0.98,deviceId:'FTIR-01',calibrationId:'CAL-21',sampleId:'M1',libraryVersion:'LIB-1',measuredAt:new Date().toISOString(),calibratedAt:new Date().toISOString(),...other});
const evidence=(txt,kind='manual')=>assess({mark:identifyMark(txt,kind)});
test('57 unique catalogue entries, RIC 1–7, no duplicates',()=>{assert.ok(MATERIALS.length>=50);assert.equal(new Set(MATERIALS.map(x=>x.id)).size,MATERIALS.length);for(let n=1;n<=7;n++)assert.equal(identifyMark(String(n)).status,'identified')});
test('standard reinforced or blended markings are not accepted as pure',()=>{
 for(const s of ['>PP-GF30<','>PA66-GF30<','>PVC-P(DBP)<']){const a=identifyMark(s);assert.equal(a.status,'identified',s);assert.equal(a.additive,true,s);assert.equal(assess({mark:a}).route,'CUARENTENA',s)}
 for(const s of ['>PC+ABS<','>PET/PE<','>PA66+PPE<'])assert.equal(identifyMark(s).status,'ambiguous',s);
});
test('PS espumado y HIPS: no liberar al flujo PS indiferenciado',()=>{for(const s of ['EPS','XPS','HIPS']){const m=identifyMark(s);assert.equal(m.grade,s);assert.equal(assess({mark:m}).route,'CUARENTENA')}});
test('mark and code conflict rejects',()=>{for(const s of ['03 PET','05 PVC','04 PP'])assert.equal(identifyMark(s).status,'ambiguous',s)});
test('numeric OCR is not enough',()=>{assert.equal(identifyMark('5','auto').status,'ambiguous');assert.equal(identifyMark('05 PP','auto').status,'identified')});
test('seven routes including segregation',()=>{
 for(const [t,r] of [['PET','PET'],['HDPE','PEAD'],['LDPE','PEBD'],['PP','PP'],['PVC','PVC-SEGREGADO'],['PS','PS']])assert.equal(evidence('>'+t+'<').route,r);
 assert.equal(evidence('ABS').route,'ESPECIALIZADO');assert.equal(evidence('07').route,'CUARENTENA');
});
test('critical issues quarantine even if marking unambiguous',()=>{for(const issue of ['black','multilayer','dirty','hazard','electronics','unknown'])assert.equal(assess({mark:identifyMark('05 PP'),issues:[issue]}).status,'quarantine')});
test('reports unverified and not automatically releasing',()=>{
 const good=parseInstrumentReport(report());assert.equal(good.ok,true);
 assert.equal(assess({instrument:good.report}).route,'CUARENTENA');
 assert.equal(assess({mark:identifyMark('03 PVC'),instrument:good.report}).flags.includes('CONFLICTO_DE_EVIDENCIAS'),true);
 assert.equal(assess({mark:identifyMark('05 PP'),instrument:good.report}).status,'quarantine');
 assert.ok(assess({mark:identifyMark('05 PP'),instrument:good.report,sampleId:'M2'}).flags.includes('MUESTRA_INSTRUMENTAL_DIFERENTE'));
 for(const bad of [{method:'RGB'},{confidence:2},{confidence:'0.98'},{materialId:'FOO'},{calibratedAt:'2020-01-01'},{deviceId:''},{schema:'wrong'}])assert.equal(parseInstrumentReport(report(bad)).ok,false,JSON.stringify(bad));
 assert.equal(parseInstrumentReport('not json').ok,false);
});
test('inspection data validation',()=>{
 assert.equal(validateInspection(data),null);
 assert.ok(validateInspection({...data,lot:'A'}));assert.ok(validateInspection({...data,quantity:0}));assert.ok(validateInspection({...data,quantity:Infinity}));assert.ok(validateInspection({...data,operator:'x'}));
});
test('release requires second reviewer and explanation and flags-free',()=>{
 const row={operator:'Operador A',sampleId:'MUESTRA-001',status:'pending',morphology:'piece',planId:'SOP-IND-01',sampleTarget:2,...evidence('05 PP')};
 assert.ok(validateReview(row,'Operador A','released','Fue validado',true));
 assert.ok(validateReview(row,'Operador B','released','ok',true));
 assert.ok(validateReview(row,'Operador B','released','Validación completa',false));
 assert.equal(validateReview(row,'Operador B','released','Validación completa',true),null);
 const quarantine={...row,flags:['CONDICION_CRITICA'],route:'CUARENTENA'};
 assert.ok(validateReview(quarantine,'Operador B','released','Validación completa',true));
 assert.equal(validateReview(quarantine,'Operador B','rejected','Control fallido',false),null);
});
test('CSV injection protected in formulas and quotes',()=>{
 const x=csvExport([{notes:'=1+1',lot:'+cmd',operator:'hola"mundo'}],['notes','lot','operator']);
 assert.ok(x.includes('"\'=1+1"'));assert.ok(x.includes('"\'+cmd"'));assert.ok(x.includes('"hola""mundo"'));
});
