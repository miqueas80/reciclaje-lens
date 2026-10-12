import {byId} from './catalog.js';
import {inspectSpectrum,spectralAngle} from './spectra.js';
/** Laboratorio experimental: cotejo de espectros con bibliotecas aportadas. Sin modelos calibrados no hay identidad confirmada. */
export function validateReferenceLibrary(l){
 if(!l||l.schema!=='nexus.spectral.library/1'||typeof l.libraryId!=='string'||l.libraryId.length<4||!Array.isArray(l.references)||!l.references.length||l.references.length>150)throw Error('Biblioteca espectral incompatible o sin referencias (máximo 150).');
 if(!Array.isArray(l.axis)||l.axis.length<16||l.axis.length>4096)throw Error('Eje espectral inválido.');
 const ids=new Set();for(const r of l.references){
  if(!r||!byId[r.materialId]||['OTHER','MULTI'].includes(r.materialId))throw Error('Material desconocido en biblioteca.');
  if(typeof r.referenceId!=='string'||r.referenceId.length<3||ids.has(r.referenceId))throw Error('Referencia ID duplicado/ausente.');ids.add(r.referenceId);
  const spectrum=inspectSpectrum({axis:l.axis,signal:r.signal,axisUnit:l.axisUnit,signalUnit:l.signalUnit});
  if(!spectrum.ok||spectrum.flags.length)throw Error('Señal de referencia inválida: '+r.referenceId);
 }
 return {libraryId:l.libraryId,version:String(l.version||'no indicada'),axis:l.axis,axisUnit:l.axisUnit,signalUnit:l.signalUnit,references:l.references.map(x=>({materialId:x.materialId,referenceId:x.referenceId,signal:x.signal})),
  status:'local_unverified_references',note:'Biblioteca no autenticada ni validada metrológicamente.'};
}
export function compareToReferences(spectrum,library){
 if(!library)throw Error('Cargá una biblioteca de referencia.');
 const q=inspectSpectrum(spectrum);if(!q.ok||q.flags.length)throw Error('Señal a comparar inválida o fuera de rango.');
 if(spectrum.axisUnit!==library.axisUnit||spectrum.signalUnit!==library.signalUnit||spectrum.axis.length!==library.axis.length)throw Error('Ejes o unidades incompatibles: prohibida la interpolación implícita.');
 for(let i=0;i<spectrum.axis.length;i++)if(Math.abs(spectrum.axis[i]-library.axis[i])>1e-7)throw Error('Ejes distintos: requieren alineación/corrección de longitud de onda supervisada.');
 // SNV minimiza offset/escala, pero debe elegirse/validarse para cada técnica y dataset.
 const snv=a=>{const mean=a.reduce((s,x)=>s+x,0)/a.length;const variance=a.reduce((s,x)=>s+(x-mean)**2,0)/a.length;if(variance<1e-24)throw Error('Señal plana.');return a.map(x=>(x-mean)/Math.sqrt(variance))};
 const normalized=snv(spectrum.signal);
 const results=library.references.map(r=>({materialId:r.materialId,referenceId:r.referenceId,angleRad:spectralAngle(normalized,snv(r.signal))})).sort((a,b)=>a.angleRad-b.angleRad);
 return {ranked:results.slice(0,5),top:results[0],marginRad:results.length>1?results[1].angleRad-results[0].angleRad:null,
  libraryId:library.libraryId,libraryVersion:library.version,source:'spectral_angle_SNV_experimental',status:'HYPOTHESIS_NOT_VALIDATED',
  note:'Cotejo SAM/SNV experimental. No es probabilidad, no mide pureza y no libera muestras/lotes.'};
}
