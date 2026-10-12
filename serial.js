/** Transporte de solo lectura; jamás envía comandos ni escribe en PLC/actuadores. */
export function createSerialReader(onLine,onError=()=>{}){
 let port=null,reader=null,active=false;
 const maxLine=128*1024;
 async function connect(baudRate=115200){
  if(active)throw Error('Ya hay una conexión activa.');
  if(!Number.isSafeInteger(baudRate)||baudRate<1200||baudRate>3000000)throw Error('Baud rate inválido.');
  if(!navigator.serial)throw Error('Web Serial no disponible: usá Chromium seguro (HTTPS).');
  port=await navigator.serial.requestPort();await port.open({baudRate});active=true;
  const decode=new TextDecoder();let pending='';
  (async()=>{try{
   reader=port.readable.getReader();while(active){const {value,done}=await reader.read();if(done)break;
    pending+=decode.decode(value,{stream:true});if(pending.length>maxLine){pending='';onError('Trama excede 128 KB; descartada.');continue}
    let p;while((p=pending.indexOf('\n'))>=0){const line=pending.slice(0,p).trim();pending=pending.slice(p+1);if(line)await onLine(line)}
   }
  }catch(e){if(active)onError(e.message)}finally{reader?.releaseLock();reader=null;active=false;try{await port?.close()}catch{}port=null}})();
  return true;
 }
 async function disconnect(){active=false;if(reader){try{await reader.cancel()}catch{}}}
 return {connect,disconnect,isActive:()=>active};
}
