/* Arrival is the push event on this device, never a click/read. OneSignal alone displays notifications. */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
const ARRIVAL_DB20='mirae-push-arrivals20',MAX_AGE20=7*86400000,MAX_PENDING20=500;
let arrivalFlight20=null,arrivalConfig20=null;
const uuid20=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function receiptData(value,depth=0){if(depth>7||!value)return null;if(typeof value==='string'){try{return receiptData(JSON.parse(value),depth+1)}catch{return null}}if(typeof value!=='object')return null;if(uuid20(value.mirae_queue)&&uuid20(value.mirae_receipt))return value;for(const v of Object.values(value)){const r=receiptData(v,depth+1);if(r)return r}return null}
function store20(mode,action){return new Promise((resolve,reject)=>{const req=indexedDB.open(ARRIVAL_DB20,1);req.onupgradeneeded=()=>req.result.createObjectStore('pending',{keyPath:'id'});req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;let tx,result;try{tx=db.transaction('pending',mode);result=action(tx.objectStore('pending'));}catch(e){db.close();reject(e);return}tx.oncomplete=()=>{db.close();resolve(result?.result)};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error)}}})}
function remembered20(){return new Promise(resolve=>{const req=indexedDB.open('mirae-push-worker',1);req.onupgradeneeded=()=>req.result.createObjectStore('config');req.onerror=()=>resolve(null);req.onsuccess=()=>{const db=req.result,r=db.transaction('config').objectStore('config').get('public');r.onsuccess=()=>{resolve(r.result);db.close()};r.onerror=()=>{resolve(null);db.close()}}})}
function validConfig20(c){try{const u=new URL(c.url);return (u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))&&typeof c.key==='string'&&c.key.length>0}catch{return false}}
async function timedFetch20(url,options={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),6000);try{return await fetch(url,{...options,signal:c.signal})}finally{clearTimeout(t)}}
async function config20(){
 if(arrivalConfig20&&Date.now()-arrivalConfig20.checked<60000)return arrivalConfig20;
 const remembered=await remembered20();let fresh=null;
 // Read public literals only; do not execute config.js. Refresh old migration destinations without requiring login.
 try{const r=await timedFetch20(new URL('../config.js',self.location.href),{cache:'no-store',credentials:'omit'});if(r.ok){const text=await r.text(),u=text.match(/SUPABASE_URL\s*:\s*("[^"\r\n]+"|location\.origin)/),k=text.match(/SUPABASE_KEY\s*:\s*("[^"\r\n]+")/);if(u&&k)fresh={url:u[1]==='location.origin'?self.location.origin:JSON.parse(u[1]),key:JSON.parse(k[1])}}}catch{}
 const c=validConfig20(fresh)?fresh:remembered;if(!validConfig20(c)||c.key!=='pc-local-server')return null;
 arrivalConfig20={...c,device_id:remembered?.device_id||'',checked:Date.now()};return arrivalConfig20;
}
async function acknowledge20(row,c){
 const headers={apikey:c.key,'Content-Type':'application/json'};if(c.key.startsWith('eyJ'))headers.Authorization='Bearer '+c.key;
 const call=async(name,body)=>{const r=await timedFetch20(new URL('/rest/v1/rpc/'+name,c.url),{method:'POST',headers,credentials:'omit',cache:'no-store',body:JSON.stringify(body)});if(!r.ok)throw Error('RECEIPT_HTTP');return await r.json()};
 const body={p_id:row.id,p_receipt:row.receipt};
 if(uuid20(row.device_id||c.device_id)){const r=await call('mirae_push_receipt_device',{...body,p_device:row.device_id||c.device_id});if(r?.ok===true)return;}
 // A valid per-notification key still proves arrival when browser storage/device ID changed.
 const r=await call('mirae_push_receipt',body);if(typeof r?.ok!=='boolean')throw Error('RECEIPT_RESPONSE');
}
async function flush20(force=false){
 if(arrivalFlight20)return arrivalFlight20;
 arrivalFlight20=(async()=>{const now=Date.now(),all=await store20('readonly',s=>s.getAll());const rows=all.sort((a,b)=>a.created-b.created);for(const r of rows)if(now-r.created>MAX_AGE20)await store20('readwrite',s=>s.delete(r.id));
 const due=rows.filter(r=>now-r.created<=MAX_AGE20&&(force||!r.next||r.next<=now)).slice(0,20);if(!due.length)return;
 const c=await config20();if(!c)return;
 for(const row of due){try{await acknowledge20(row,c);await store20('readwrite',s=>s.delete(row.id))}catch{row.attempts=(row.attempts||0)+1;row.next=Date.now()+Math.min(300000,2000*Math.pow(2,Math.min(row.attempts-1,8)));await store20('readwrite',s=>s.put(row));break;}}
 })().finally(()=>{arrivalFlight20=null});return arrivalFlight20;
}
async function background20(){try{if(self.registration.sync)await self.registration.sync.register('mirae-push-arrivals20')}catch{}}
async function arrival20(payload){
 const row={id:payload.mirae_queue,receipt:payload.mirae_receipt,created:Date.now(),attempts:0,next:0};
 try{const c=await remembered20();row.device_id=c?.device_id||'';const old=await store20('readonly',s=>s.get(row.id));if(!old)await store20('readwrite',s=>s.put(row));const all=await store20('readonly',s=>s.getAll());for(const r of all.sort((a,b)=>b.created-a.created).slice(MAX_PENDING20))await store20('readwrite',s=>s.delete(r.id));
  await flush20();if(await store20('readonly',s=>s.get(row.id))){await new Promise(r=>setTimeout(r,2200));await flush20();await background20()}
 }catch{try{const c=await config20();if(c)await acknowledge20(row,c)}catch{}}
}
self.addEventListener('push',event=>{let p;try{p=receiptData(event.data.json())}catch{}event.waitUntil(p?arrival20(p):flush20().catch(()=>{}))});
self.addEventListener('activate',event=>event.waitUntil(flush20().catch(()=>{})));
self.addEventListener('sync',event=>{if(event.tag==='mirae-push-arrivals20')event.waitUntil(flush20(true).then(async()=>{if((await store20('readonly',s=>s.getAll())).length)throw Error('RECEIPT_PENDING')}))});
self.addEventListener('message',event=>{if(event.data?.type!=='MIRAE_RECEIPT_FLUSH20')return;try{if(new URL(event.source.url).origin!==self.location.origin)return}catch{return}arrivalConfig20=null;event.waitUntil(flush20().catch(()=>{}))});
