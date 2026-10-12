import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {stableJSON,verifyEnvelope,validateTrustedKey,bytesToBase64,manifestForBackup,checkManifest} from '../trust.js';
import {inspectSpectrum,spectralAngle} from '../spectra.js';
import {assess,parseInstrumentReport} from '../workflow.js';
import {identifyMark} from '../identify.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const now=new Date();
const iso=x=>new Date(now.getTime()+x).toISOString();
async function signedSetup(){
 const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 const pub=bytesToBase64(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey)));
 const trusted=[validateTrustedKey({keyId:'KEY-001',deviceId:'FTIR-01',publicKey:pub})];
 const payload={schema:'nexus.spectrometer.result/1',lot:'LOT-001',sampleId:'SMP-001',measurementId:'READ-001',deviceId:'FTIR-01',method:'FTIR',materialId:'PP',confidence:0.93,calibrationId:'CAL-11',calibratedAt:iso(-86400000),calibrationValidUntil:iso(86400000),measuredAt:iso(-10000),libraryVersion:'LIB-1'};
 async function sign(p){const sig=new Uint8Array(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(stableJSON(p))));return {schema:'nexus.instrument.signed/2',payload:p,signature:{algorithm:'Ed25519',keyId:'KEY-001',value:bytesToBase64(sig)}};}
 return {trusted,payload,sign};
}
test('Ed25519 genuine signed spectrometer envelope verifies and binds lot/sample',async()=>{
 const {trusted,payload,sign}=await signedSetup();
 const e=await sign(payload),v=await verifyEnvelope(e,trusted,{lot:'LOT-001',sampleId:'SMP-001'});
 assert.equal(v.ok,true);assert.equal(v.signatureVerified,true);assert.equal(v.rawDigest.length,64);
 assert.equal(parseInstrumentReport(v.payload).ok,true);
 assert.equal((await verifyEnvelope(e,trusted,{lot:'OTHER',sampleId:'SMP-001'})).ok,false);
 assert.equal((await verifyEnvelope(e,trusted,{lot:'LOT-001',sampleId:'OTHER'})).ok,false);
});
test('tamper, unknown device, invalid algorithm and stale calibration fail closed',async()=>{
 const {trusted,payload,sign}=await signedSetup(),good=await sign(payload);
 assert.equal((await verifyEnvelope({...good,payload:{...payload,materialId:'PET'}},trusted)).ok,false);
 assert.equal((await verifyEnvelope(good,[])).ok,false);
 assert.equal((await verifyEnvelope({...good,signature:{...good.signature,algorithm:'SHA1'}},trusted)).ok,false);
 assert.equal((await verifyEnvelope(await sign({...payload,calibrationValidUntil:iso(-90000)}),trusted)).ok,false);
 assert.equal((await verifyEnvelope(await sign({...payload,measuredAt:iso(-10*86400000)}),trusted)).ok,false);
 assert.throws(()=>validateTrustedKey({...trusted[0],publicKey:bytesToBase64(new Uint8Array(16))}));
});
test('instrument signed origin never equals validated assay or automatic actuator approval',()=>{
 const result=assess({lot:'LOT-001',sampleId:'SMP-001',morphology:'flake',instrument:{materialId:'PP',sampleId:'SMP-001',lot:'LOT-001',method:'FTIR',signatureVerified:true}});
 assert.equal(result.route,'CUARENTENA');assert.equal(result.automaticRelease,false);assert.ok(result.flags.includes('METROLOGIA_NO_VALIDADA'));
 const black=assess({lot:'LOT-001',sampleId:'SMP-001',morphology:'pellet',issues:['black'],instrument:{materialId:'PP',sampleId:'SMP-001',lot:'LOT-001',method:'NIR',signatureVerified:true}});
 assert.ok(black.flags.includes('NIR_NO_APTO_NEGRO_CARBON'));
 const conflicting=assess({lot:'LOT-001',sampleId:'SMP-001',morphology:'piece',mark:identifyMark('03 PVC'),instrument:{materialId:'PP',sampleId:'SMP-001',lot:'LOT-002',signatureVerified:true}});
 assert.ok(conflicting.flags.includes('CONFLICTO_DE_EVIDENCIAS'));assert.ok(conflicting.flags.includes('LOTE_INSTRUMENTAL_DIFERENTE'));
});
test('backup sha256 manifest detects edited records and audit',async()=>{
 const records=[{id:'1',lot:'A',status:'quarantine'}],audit=[{id:'x',detail:'hello'}];const integ=await manifestForBackup(records,audit);
 assert.equal(await checkManifest({records,audit,integrity:integ}),true);
 assert.equal(await checkManifest({records:[{...records[0],lot:'B'}],audit,integrity:integ}),false);
 assert.equal(await checkManifest({records,audit:[{...audit[0],detail:'changed'}],integrity:integ}),false);
});
test('spectral diagnostic validates unit, axis ordering, finite signals and saturated reflectance',()=>{
 const axis=Array.from({length:32},(_,i)=>1000+i*10),signal=axis.map((_,i)=>.3+Math.sin(i)*.03);
 const ok=inspectSpectrum({axis,signal,axisUnit:'nm',signalUnit:'reflectance'});
 assert.equal(ok.ok,true);assert.equal(ok.points,32);assert.ok(ok.std>0);assert.equal(ok.flags.length,0);
 assert.equal(inspectSpectrum({axis,signal:signal.map(()=>.5),axisUnit:'nm',signalUnit:'reflectance'}).flags.includes('SEÑAL_PLANA'),true);
 assert.equal(inspectSpectrum({axis,signal:signal.map(()=>1.5),axisUnit:'nm',signalUnit:'reflectance'}).flags.includes('REFLECTANCIA_FUERA_0_1'),true);
 assert.equal(inspectSpectrum({axis:[...axis].reverse(),signal,axisUnit:'nm',signalUnit:'reflectance'}).ok,false);
 assert.equal(inspectSpectrum({axis,signal:[...signal.slice(0,-1),NaN],axisUnit:'nm',signalUnit:'reflectance'}).ok,false);
 assert.ok(Math.abs(spectralAngle([1,2,3],[2,4,6]))<1e-7);
 assert.throws(()=>spectralAngle([0,0],[1,2]));
});
