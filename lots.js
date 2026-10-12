/** Indicadores agregados para la revisión humana de un lote. No certifican pureza. */
export function summarizeLots(rows){
 const groups=new Map();
 for(const row of rows){
  const id=String(row.lot||'SIN-LOTE');
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(row);
 }
 return [...groups].map(([lot,items])=>{
  const statuses={pending:0,quarantine:0,released:0,rejected:0,void:0};
  const materials=new Set();let kg=0;let unknown=0;let missingSample=0;
  const samples=new Set();let repeatedSamples=0;
  const active=items.filter(r=>r.status!=='void');
  const plans=new Set(active.map(r=>r.planId).filter(Boolean));
  const targets=new Set(active.map(r=>r.sampleTarget).filter(x=>Number.isSafeInteger(x)&&x>0));
  const morphologies=new Set(active.map(r=>r.morphology).filter(Boolean));
  const planId=plans.size===1?[...plans][0]:null;
  const sampleTarget=targets.size===1?[...targets][0]:null;
  for(const r of items){
   statuses[r.status]=(statuses[r.status]||0)+1;
   if(r.status!=='void'&&r.materialId&&r.materialId!=='OTHER')materials.add(r.materialId);
   if(r.status!=='void'&&!r.materialId)unknown++;
   if(r.status!=='void'){
    if(!r.sampleId)missingSample++;
    else if(samples.has(r.sampleId.toUpperCase()))repeatedSamples++;
    else samples.add(r.sampleId.toUpperCase());
   }
   if(r.unit==='kg'&&r.status!=='void')kg+=Number(r.quantity)||0;
  }
  const reasons=[];
  if(statuses.quarantine||statuses.rejected)reasons.push('Contiene inspecciones retenidas o rechazadas');
  if(statuses.pending)reasons.push('Inspecciones sin segundo control');
  if(unknown)reasons.push('Materiales no identificados');
  if(materials.size>1)reasons.push('Polímeros diferentes en el mismo lote');
  if(missingSample||repeatedSamples)reasons.push('Trazabilidad de muestras incompleta o duplicada');
  if(active.length===0)reasons.push('No hay inspecciones activas');
  if(plans.size!==1||targets.size!==1||active.some(r=>!r.planId||!Number.isSafeInteger(r.sampleTarget)))reasons.push('Plan de muestreo ausente o contradictorio');
  if(sampleTarget!==null&&samples.size<sampleTarget)reasons.push('Muestreo pendiente: faltan '+(sampleTarget-samples.size)+' muestras según el plan declarado');
  if(morphologies.size>1||active.some(r=>!r.morphology))reasons.push('Formato físico mezclado o no registrado: revisar representatividad');
  // Aunque las inspecciones estén cerradas, nunca afirmar aprobación industrial del lote.
  return {lot,total:items.length,kg,statuses,materials:[...materials],unknown,missingSample,repeatedSamples,planId,sampleTarget,observedSamples:samples.size,remainingSamples:sampleTarget===null?null:Math.max(0,sampleTarget-samples.size),morphologies:[...morphologies],
   disposition:reasons.length?'RETENER / REVISAR':'INSPECCIONES CERRADAS',reasons,
   certificate:false};
 }).sort((a,b)=>a.lot.localeCompare(b.lot));
}
