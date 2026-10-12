/** DEMO SINTÉTICA: no es espectro real, no usar como evidencia ni como clave productiva. */
import {webcrypto} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {stableJSON,bytesToBase64,sha256} from '../trust.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const lot=process.argv[2]||'LOT-DEMO',sampleId=process.argv[3]||'SMP-DEMO';
if(!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(lot)||!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(sampleId))throw Error('IDs no válidos');
const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
const pub=bytesToBase64(new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)));
const axis=Array.from({length:64},(_,i)=>1000+i*5);
const signal=axis.map((_,i)=>Number((.3+.2*Math.sin(i/7)+.05*Math.cos(i/3)).toFixed(7)));
const now=new Date(),before=x=>new Date(now.getTime()-x).toISOString(),after=x=>new Date(now.getTime()+x).toISOString();
const payload={schema:'nexus.spectrometer.result/1',method:'FTIR',materialId:'PP',confidence:0.98,lot,sampleId,
 measurementId:'SIM-'+crypto.randomUUID(),deviceId:'SIM-FTIR-01',calibrationId:'CAL-SIM-FAKE',calibratedAt:before(86400000),calibrationValidUntil:after(86400000),
 measuredAt:before(1000),libraryVersion:'SIMULATED-NOT-METROLOGY',spectrum:{axis,signal,axisUnit:'nm',signalUnit:'reflectance'}};
const signature=bytesToBase64(new Uint8Array(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(stableJSON(payload)))));
const envelope={schema:'nexus.instrument.signed/2',payload,signature:{algorithm:'Ed25519',keyId:'KEY-SIM-01',value:signature}};
await mkdir('examples',{recursive:true});await writeFile('examples/sensor-signed-SIMULATION.json',JSON.stringify(envelope,null,2));
await writeFile('examples/SIMULATION-PUBLIC-KEY.txt',`keyId: KEY-SIM-01\ndeviceId: SIM-FTIR-01\npublicKey: ${pub}\nSHA256 (clave pública): ${await sha256(crypto.subtle?new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)):pub)}\n\nDEMO de interfaz, ninguna identidad, espectro ni calibración real.\n`);
console.log('Generados examples/sensor-signed-SIMULATION.json y examples/SIMULATION-PUBLIC-KEY.txt');console.log('NO SE GUARDA LA CLAVE PRIVADA. Las simulaciones NO son evidencia química.');
