import test from 'node:test';import assert from 'node:assert/strict';
import {validateReferenceLibrary,compareToReferences} from '../spectral-lab.js';
const axis=Array.from({length:64},(_,i)=>1000+i*5);
const wave=(phase)=>axis.map((_,i)=>.3+Math.sin((i+phase)/7)*.2+Math.cos((i+phase)/3)*.05);
const sample={axis,axisUnit:'nm',signalUnit:'reflectance',signal:wave(0)};
const library={schema:'nexus.spectral.library/1',libraryId:'DEMO-SYNTHETIC',version:'1',axis,axisUnit:'nm',signalUnit:'reflectance',references:[{referenceId:'SYN-001',materialId:'PP',signal:wave(0)},{referenceId:'SYN-002',materialId:'PET',signal:wave(11)}]};
test('SAM/SNV ranks identical synthetic signals first, no claims of purity or probability',()=>{
 const ref=validateReferenceLibrary(library),result=compareToReferences(sample,ref);
 assert.equal(result.top.materialId,'PP');assert.ok(result.top.angleRad<1e-6);assert.equal(result.status,'HYPOTHESIS_NOT_VALIDATED');assert.equal(result.ranked.length,2);
});
test('experimental library rejects duplicate ids, invalid axes and unknown polymers',()=>{
 assert.throws(()=>validateReferenceLibrary({...library,references:[library.references[0],library.references[0]]}));
 assert.throws(()=>validateReferenceLibrary({...library,references:[{...library.references[0],materialId:'NOT-POLYMER'}]}));
 assert.throws(()=>validateReferenceLibrary({...library,axis:[...axis].reverse()}));
});
test('refuse unit mismatch, axis misalignment, out-of-range reflectance and flat signal',()=>{
 const ref=validateReferenceLibrary(library);
 assert.throws(()=>compareToReferences({...sample,axisUnit:'cm-1'},ref));
 assert.throws(()=>compareToReferences({...sample,axis:axis.map(x=>x+1)},ref));
 assert.throws(()=>compareToReferences({...sample,signal:axis.map(()=>2)},ref));
 assert.throws(()=>compareToReferences({...sample,signal:axis.map(()=>.5)},ref));
});
