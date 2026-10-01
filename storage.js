/* No Python service. These RPCs are atomic storage operations in the existing Supabase DB. */
(function(root){
'use strict';
const arrays=['accounts','parents','students','classes','enrollments','lessons','feedback','exams','scores','consultations','videos','video_progress','audit','parentHistory','roster'];
const copy=x=>JSON.parse(JSON.stringify(x));
const logs=[];
function log(event,detail={}){const row={time:new Date().toISOString(),version:'2.1.2',event,...detail};logs.push(row);if(logs.length>600)logs.shift();root.dispatchEvent?.(new Event('mirae-log'));}
function empty(){const d=Object.fromEntries(arrays.map(k=>[k,[]]));return Object.assign(d,{parentPasswords:{},mswitch:{},settings:{},timenet_meta:{},submissions:[],attachments:[],lesson_files:[]});}
function flatten(d){const map=new Map();for(const name of arrays)for(const row of d[name]||[]){if(!row.id)throw Error(name+': 저장할 항목의 ID가 없습니다.');map.set(name+'/'+row.id,copy(row))}for(const k of ['parentPasswords','mswitch','settings','timenet_meta','loginDesign','designRevision'])if(d[k]!==undefined)map.set('settings/'+k,copy(d[k]));return map}
function inflate(map){const d=empty();for(const [key,value]of map){const [kind,id]=key.split('/');if(arrays.includes(kind))d[kind].push(copy(value));else if(kind==='settings'&&['parentPasswords','mswitch','settings','timenet_meta','loginDesign','designRevision'].includes(id))d[id]=copy(value)}return d}
class Store{
 constructor(config={},transport){this.config=config;this.transport=transport;this.documents=new Map();this.revision=-1;this.queue=Promise.resolve()}
 configured(){return Boolean(this.config.SUPABASE_URL&&this.config.SUPABASE_KEY)}
 async rpc(name,body){
  if(this.transport)return this.transport(name,body);
  if(!this.configured())throw Error('Supabase 연결 설정이 없습니다. setup.html에서 설정해 주세요.');
  const base=new URL(this.config.SUPABASE_URL),key=String(this.config.SUPABASE_KEY).trim();
  if(base.protocol!=='https:')throw Error('Supabase 주소는 https://로 시작해야 합니다.');
  if(key.startsWith('sb_secret_'))throw Error('Secret 키는 사용할 수 없습니다. Publishable 또는 anon 키를 입력하세요.');
  const headers={'apikey':key,'Content-Type':'application/json'};
  if(key.startsWith('eyJ')){let claims;try{claims=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{throw Error('Supabase anon 키 형식을 확인해 주세요.')}if(claims.role!=='anon')throw Error('anon 키만 입력하세요. service_role 키는 사용할 수 없습니다.');headers.Authorization='Bearer '+key}
  const started=Date.now();log('supabase.request',{operation:name});
  let r;try{r=await fetch(base.origin+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000),credentials:'omit'})}catch(e){log('supabase.network_error',{operation:name,kind:e.name});throw Error('Supabase 응답을 받지 못했습니다. 인터넷·프로젝트 URL을 확인하세요. 저장 중이었다면 새로고침해서 반영 여부를 먼저 확인하세요.')}
  let data;try{data=await r.json()}catch{throw Error('Supabase 응답 형식을 확인하지 못했습니다.')}
  log('supabase.response',{operation:name,status:r.status,elapsed_ms:Date.now()-started,...(!r.ok?{code:String(data.code||'unknown')}:{})});
  if(!r.ok)throw Error(['PGRST202','42P01','42883'].includes(data.code)?'v2.0 SQL 설치가 필요합니다. 01_v2_0_install.sql을 Supabase SQL Editor에서 실행하세요.':`Supabase 요청 실패 (${r.status}, ${data.code||'unknown'}). 설정·로그의 내용을 복사해 주세요.`);
  return data;
 }
 async refresh(){const res=await this.rpc('mirae_v2_read',{after_revision:this.revision});if(!Number.isInteger(res.revision)||!Array.isArray(res.documents))throw Error('v2.0 데이터 응답이 올바르지 않습니다.');if(res.revision<this.revision){this.revision=-1;this.documents.clear();return this.refresh()}for(const doc of res.documents){if(doc.deleted)this.documents.delete(doc.key);else this.documents.set(doc.key,doc.value)}this.revision=res.revision;return inflate(this.documents)}
 run(write,handler){const job=this.queue.then(async()=>{for(let attempt=0;attempt<3;attempt++){
   const state=await this.refresh(),result=await handler(state),next=flatten(state);
   if(!write)return result;
   const changes=[];for(const [key,value]of next)if(JSON.stringify(value)!==JSON.stringify(this.documents.get(key)))changes.push({key,value});for(const key of this.documents.keys())if(!next.has(key))changes.push({key,deleted:true});
   if(!changes.length)return result;
   const response=await this.rpc('mirae_v2_commit',{expected_revision:this.revision,changes});
   if(response.ok){this.documents=next;this.revision=response.revision;log('save.complete',{changed:changes.length,revision:this.revision});return result}
   log('save.conflict',{attempt:attempt+1});
  }throw Error('다른 사용자가 같은 시점에 저장했습니다. 새로고침한 후 다시 저장해 주세요.');});this.queue=job.catch(()=>{});return job}
}
if(!root.MIRAE_CONFIG?.SUPABASE_URL){try{const saved=JSON.parse(root.localStorage?.getItem('mirae-v2-connection')||'null');if(saved?.SUPABASE_URL)root.MIRAE_CONFIG={...(root.MIRAE_CONFIG||{}),...saved}}catch{}}
const api=new Store(root.MIRAE_CONFIG||{});
api.log=log;api.logs=()=>logs.map(x=>JSON.stringify(x)).join('\n');api.empty=empty;api.Store=Store;api.inflate=inflate;api.flatten=flatten;
root.MiraeStore=api;
if(typeof module!=='undefined')module.exports={Store,empty,flatten,inflate};
})(typeof window!=='undefined'?window:globalThis);
