import {byId} from './catalog.js';
export const ROUTES={PET:'PET',HDPE:'PEAD',LDPE:'PEBD',PP:'PP',PS:'PS',PVC:'PVC-SEGREGADO'};
export const METHODS=['NIR','FTIR','MIR','RAMAN'];
export const MORPHOLOGIES=['piece','film','flake','pellet','powder','mixed'];
export const STATES={pending:'Pendiente de control',released:'Inspección cerrada (QA)',quarantine:'Cuarentena',rejected:'Rechazado',void:'Anulado'};
const clean=s=>String(s??'').trim();
const validDate=s=>{const d=Date.parse(s);return Number.isFinite(d)?d:null};
/** Solo importa una conclusión declarada por otro instrumento; NO interpreta espectros crudos. */
export function parseInstrumentReport(value){
 let o;
 try{o=typeof value==='string'?JSON.parse(value):value}catch{return {ok:false,error:'El informe no es JSON válido.'}}
 if(!o||typeof o!=='object'||Array.isArray(o))return {ok:false,error:'Informe inválido.'};
 if(o.schema!=='nexus.spectrometer.result/1')return {ok:false,error:'Esquema distinto. Se requiere nexus.spectrometer.result/1.'};
 if(!METHODS.includes(o.method))return {ok:false,error:'Técnica no admitida: NIR, FTIR, MIR o RAMAN.'};
 if(!byId[o.materialId]||o.materialId==='OTHER'||o.materialId==='MULTI')return {ok:false,error:'Identificador de polímero no compatible con el catálogo.'};
 if(typeof o.confidence!=='number'||!Number.isFinite(o.confidence)||o.confidence<0||o.confidence>1)return {ok:false,error:'confidence debe ser un número entre 0 y 1.'};
 const date=validDate(o.measuredAt);
 if(date===null||date>Date.now()+300000||date<Date.now()-365*24*3600*1000)return {ok:false,error:'Fecha de medición inválida o fuera de rango (máximo 365 días).'};
 for(const key of ['deviceId','calibrationId','sampleId','libraryVersion'])if(clean(o[key]).length<2||clean(o[key]).length>100)return {ok:false,error:`Campo ${key} obligatorio (2–100 caracteres).`};
 const calibrated=validDate(o.calibratedAt);
 if(calibrated===null||calibrated>date+300000||calibrated<date-180*86400000)return {ok:false,error:'Calibración sin fecha válida o anterior a 180 días de la medición.'};
 // Aun si el JSON supera la validación de forma, no valida de modo independiente la medición ni la firma.
 return {ok:true,report:{schema:o.schema,method:o.method,materialId:o.materialId,confidence:o.confidence,
  deviceId:clean(o.deviceId),calibrationId:clean(o.calibrationId),sampleId:clean(o.sampleId),libraryVersion:clean(o.libraryVersion),
  measuredAt:new Date(date).toISOString(),calibratedAt:new Date(calibrated).toISOString(),source:'instrument_import_unverified'}};
}
export function assess({mark=null,instrument=null,issues=[],lot='',sampleId='',morphology='piece'}={}){
 const flags=[];
 if(mark?.status==='ambiguous')flags.push('MARCADO_AMBIGUO');
 if(mark?.status==='identified' && mark.material.id==='OTHER')flags.push('RIC_07_NO_IDENTIFICA_POLIMERO');
 if(mark?.composite||mark?.additive)flags.push('COMPUESTO_O_ADITIVOS');
 if(mark?.material?.id==='PS'&&mark?.grade)flags.push('SUBTIPO_PS_SEPARADO');
 if(issues.some(x=>['black','multilayer','dirty','hazard','unknown','electronics','chlorine','fire_retardant','unidentified_additives','high_moisture','unverified_mark'].includes(x)))flags.push('CONDICION_CRITICA');
 const isMarkedUnit=morphology==='piece';
 if(mark?.status==='identified'&&!isMarkedUnit)flags.push('MARCA_NO_VINCULABLE_A_PIEZA');
 const mid=isMarkedUnit&&mark?.status==='identified'?mark.material.id:null;
 const sid=instrument?.materialId||null;
 if(mid&&sid&&mid!==sid)flags.push('CONFLICTO_DE_EVIDENCIAS');
 if(sid&&sampleId&&instrument.sampleId.toUpperCase()!==sampleId.trim().toUpperCase())flags.push('MUESTRA_INSTRUMENTAL_DIFERENTE');
 if(sid&&instrument.lot&&instrument.lot!==lot.trim())flags.push('LOTE_INSTRUMENTAL_DIFERENTE');
 // JSON importado no tiene firma/autenticación: jamás habilita liberación QA.
 if(sid){
  if(instrument.signatureVerified===true){
   flags.push('METROLOGIA_NO_VALIDADA');
   if(instrument.method==='NIR'&&issues.includes('black'))flags.push('NIR_NO_APTO_NEGRO_CARBON');
  }else flags.push('INSTRUMENTO_NO_AUTENTICADO');
 }
 if(sid&&!mid)flags.push('INFORME_NO_CORROBORADO');
 const id=flags.includes('CONFLICTO_DE_EVIDENCIAS')?null:(sid||mid||null);
 if(!id)flags.push('SIN_IDENTIFICACION');
 const destination=(!id||flags.length)?'CUARENTENA':(ROUTES[id]||'ESPECIALIZADO');
 return {materialId:id,route:destination,flags,requiresReview:true,
  automaticRelease:false,source:sid?(instrument.signatureVerified?'instrumento_firma_verificada_sin_certificado':'informe_instrumental_no_verificado'):mid?'marcado':'ninguna',
  status:flags.length?'quarantine':'pending',
  detail:flags.length?'Retener. Inspección / ensayos requeridos.':'Revisión humana obligatoria. No hay salida física automática.'};
}
export function validateInspection(o){
 if(!o||typeof o!=='object')return 'Formulario vacío.';
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,49}$/.test(clean(o.lot)))return 'Lote: 2–50 caracteres alfanuméricos, punto, guion o guion bajo.';
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,49}$/.test(clean(o.sampleId)))return 'ID de muestra obligatorio: 2–50 caracteres alfanuméricos, punto, guion o guion bajo.';
 if(clean(o.operator).length<3||clean(o.operator).length>80)return 'Identificación del operador: 3–80 caracteres.';
 if(!MORPHOLOGIES.includes(o.morphology))return 'Seleccioná formato: pieza, film, escama, pellet, polvo o mezcla.';
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{2,49}$/.test(clean(o.planId)))return 'Indicá el plan de muestreo aprobado (3–50 caracteres).';
 if(!Number.isSafeInteger(o.sampleTarget)||o.sampleTarget<1||o.sampleTarget>100000)return 'Indicar cantidad objetivo de muestras (1–100.000), según plan aprobado por la planta.';
 if(!['post-consumo','industrial','electronico','otro'].includes(o.origin))return 'Seleccionar origen válido.';
 if(!['unidad','kg'].includes(o.unit))return 'Unidad no válida.';
 if(typeof o.quantity!=='number'||!Number.isFinite(o.quantity)||o.quantity<=0||o.quantity>1000000)return 'Cantidad mayor que 0 y menor o igual a 1.000.000.';
 if(clean(o.notes).length>1000)return 'Observaciones demasiado extensas.';
 return null;
}
export function validateReview(row,operator,nextState,reason,checked){
 if(!['released','quarantine','rejected','void'].includes(nextState))return 'Estado inválido.';
 if(!row||row.status==='void')return 'No se puede modificar un registro anulado.';
 if(row.status!=='pending'&&row.status!=='quarantine')return 'Un registro finalizado no se modifica: anular con motivo y crear uno nuevo.';
 if(clean(operator).length<3)return 'Identificar al responsable de la revisión.';
 if(nextState==='released'&&clean(operator).toLowerCase()===clean(row.operator).toLowerCase())return 'La liberación requiere un segundo responsable distinto del inspector.';
 if(clean(reason).length<8)return 'Justificación de al menos 8 caracteres.';
 if(nextState==='released'){
  if(!checked)return 'Debés confirmar el control manual de la muestra.';
  if(!row.materialId||row.materialId==='OTHER'||row.flags?.length||row.route==='CUARENTENA'||!row.sampleId||Boolean(row.instrument)||row.morphology!=='piece'||!row.planId||!Number.isSafeInteger(row.sampleTarget))return 'No se puede liberar: evidencia insuficiente, falta de muestra, sensor no autenticado, compuesto o conflicto.';
 }
 return null;
}
export function csvExport(rows,cols){
 const cell=v=>{let s=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 return '\ufeff'+[cols.join(';'),...rows.map(r=>cols.map(k=>cell(Array.isArray(r[k])?r[k].join('|'):r[k])).join(';'))].join('\r\n');
}
