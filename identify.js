import {MATERIALS,byRic} from './catalog.js';

export const normalize = s => String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[‐‑–—]/g,'-').trim();
const escRX=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const token=s=>new RegExp('(^|[^A-Z0-9])'+escRX(s)+'(?=$|[^A-Z0-9])');
const CODE=/\b(?:RIC|RESIN|RESINA|CODIGO|CODE|PLASTICO)\s*[:#-]?\s*0?([1-7])\b/;
const COMBO=/(?:^|[^0-9])0?([1-7])\s*(?:PETE?|HDPE|PE-HD|PEAD|PVC|LDPE|PE-LD|PEBD|PP|PS|OTHER|OTROS)\b/;
const MODIFIER=/(?:^|[-\s])(?:GF|MD|TD|CF|FR|GB|RF|LGF)(?:\d|\(|$)|-P\(/;
const FAMILY_ALIASES=new Map(MATERIALS.map(m=>[m.id,[m.id,...m.aliases].filter(a=>a.length>=2 && a!=='OTHER' || a===m.id)]));

/** Interpreta rótulos, nunca determina composición molecular por imagen. */
export function identifyMark(raw,source='manual'){
 const text=normalize(raw);
 if(!text) return {status:'unknown',reason:'No se ingresó una marca.',raw:text};
 if(text.length>8000) return {status:'unknown',reason:'Texto demasiado extenso para un marcado.',raw:text.slice(0,100)};
 const marked=[...text.matchAll(/>\s*([^<>]{1,90})\s*</g)].map(x=>x[1].trim());
 const expressions=marked.length?marked:[text];
 const parts=[];let composite=false;let additive=false;
 for(const expr of expressions){
  // Un '+' dentro de (GF+MD) expresa refuerzos; fuera indica blend polimérico.
  const outside=expr.replace(/\([^)]*\)/g,'');
  if(/\b[A-Z][A-Z0-9-]{1,11}\s*[/+]\s*[A-Z][A-Z0-9-]{1,11}\b/.test(outside))composite=true;
  if(MODIFIER.test(expr)||/\bFR\(/.test(expr))additive=true;
  parts.push(expr);
 }
 const scrubbed=expressions.join(' ').replace(/\b(PP|PA\d*|PE|PC|ABS|PVC|PET|PS|PBT|PPS|SAN|ASA|POM|PMMA|PLA|PTFE|PUR|PU|PETG|HDPE|LDPE)-(?:GF|MD|TD|CF|GB|RF|LGF)\d+/g,'$1');
 // Para '07 OTHER' mantener OTHER genérico, no asumir polímero.
 const ids=new Set();
 for(const m of MATERIALS){
  if(m.id==='OTHER'||m.id==='MULTI')continue;
  for(const alias of FAMILY_ALIASES.get(m.id)||[]){
   // Códigos de una sola letra no sirven para identificación automática.
   if(alias.length===1){if(marked.some(s=>s===alias))ids.add(m.id);continue;}
   if(token(normalize(alias)).test(scrubbed)){ids.add(m.id);break;}
  }
 }
 // Las formas genéricas EPS, HIPS, XPS están registradas como PS.
 let num;
 const single=text.match(/^(?:0)?([1-7])$/);
 const explicit=text.match(CODE)||text.match(COMBO);
 if(single)num=single[1];else if(explicit)num=explicit[1];
 const materialIds=[...ids];
 if(composite){return {status:'ambiguous',reason:'Se detectó una mezcla o laminado de polímeros. Requiere corriente compuesta; no clasificar como resina pura.',raw:text,candidates:materialIds,composite:true};}
 if(num){
  const byCode=byRic[num];
  if(source!=='manual'&&single)return {status:'ambiguous',raw:text,reason:'Número aislado en una imagen. Verificar el símbolo de resina original.',proposed:byCode.id};
  if(materialIds.length===0)return {status:'identified',material:byCode,method:'ric',raw:text,additive:false,detail:'Código RIC indicado. No certifica composición ni reciclabilidad.'};
  if(materialIds.length===1 && materialIds[0]===byCode.id)return {status:'identified',material:byCode,method:'mark',raw:text,additive,detail:'Código y sigla coinciden.'};
  return {status:'ambiguous',raw:text,reason:'Incompatibilidad entre el código RIC y la sigla, o múltiples polímeros.',candidates:materialIds};
 }
 if(materialIds.length===1){const material=MATERIALS.find(m=>m.id===materialIds[0]);const grade=material.id==='PS'?[ 'EPS','XPS','HIPS'].find(v=>token(v).test(text)):material.id==='PA'?['PA6','PA66','PA-6','PA-66'].find(v=>token(v).test(text)):null;return {status:'identified',material,method:'mark',raw:text,additive,grade:grade||null,detail:additive?'Marcado con carga, aditivo o refuerzo: NO es resina pura.':'Sigla de polímero observada; composición no medida.'};}
 if(materialIds.length>1)return {status:'ambiguous',raw:text,reason:'Se leyeron varias siglas de polímeros. Aislar componente o medir.',candidates:materialIds};
 return {status:'unknown',raw:text,reason:'El texto no contiene un código o sigla inequívocos.'};
}
