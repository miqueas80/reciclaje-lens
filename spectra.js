/** Herramientas de QA espectral; no convierten una señal en identidad química certificada. */
export function inspectSpectrum(s){
 if(!s||!Array.isArray(s.axis)||!Array.isArray(s.signal)||s.axis.length!==s.signal.length||s.axis.length<16||s.axis.length>4096)return {ok:false,reason:'Se requieren entre 16 y 4096 pares espectrales.'};
 if(!['nm','cm-1'].includes(s.axisUnit)||!['reflectance','absorbance','counts'].includes(s.signalUnit))return {ok:false,reason:'Unidades instrumentales no reconocidas.'};
 for(let i=0;i<s.axis.length;i++){
  if(!Number.isFinite(s.axis[i])||!Number.isFinite(s.signal[i]))return {ok:false,reason:'Señal con NaN/Infinity.'};
  if(i&&s.axis[i]<=s.axis[i-1])return {ok:false,reason:'Eje espectral no estrictamente creciente.'};
 }
 const n=s.signal.length,mean=s.signal.reduce((a,b)=>a+b,0)/n;
 const std=Math.sqrt(s.signal.reduce((a,b)=>a+(b-mean)**2,0)/n);
 const min=Math.min(...s.signal),max=Math.max(...s.signal);
 const differences=s.signal.slice(1).map((v,i)=>Math.abs(v-s.signal[i]));
 const median=arr=>{const sorted=[...arr].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]};
 const noiseProxy=median(differences);
 const flags=[];
 if(std<=1e-12)flags.push('SEÑAL_PLANA');
 if(s.signalUnit==='reflectance'&&(min<0||max>1))flags.push('REFLECTANCIA_FUERA_0_1');
 if(s.signalUnit==='counts'&&min<0)flags.push('CUENTAS_NEGATIVAS');
 return {ok:true,points:n,range:[s.axis[0],s.axis[n-1]],min,max,mean,std,noiseProxy,flags,
  note:'Diagnóstico descriptivo; no estima pureza ni identifica polímero. Umbrales específicos requieren validación metrológica.'};
}
export function spectralAngle(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||a.length<2||a.some(x=>!Number.isFinite(x))||b.some(x=>!Number.isFinite(x)))throw Error('Vectores espectrales incompatibles.');
 const dot=a.reduce((s,x,i)=>s+x*b[i],0), aa=a.reduce((s,x)=>s+x*x,0),bb=b.reduce((s,x)=>s+x*x,0);
 if(!aa||!bb)throw Error('Vector sin señal.');
 return Math.acos(Math.max(-1,Math.min(1,dot/Math.sqrt(aa*bb))));
}
