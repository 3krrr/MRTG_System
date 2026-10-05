/* No Python service. These RPCs are atomic storage operations in the existing Supabase DB. */
(function(root){
'use strict';
const arrays=['accounts','parents','students','classes','enrollments','lessons','feedback','exams','scores','consultations','videos','video_progress','audit','parentHistory','roster','attendance','attendanceMessages','studentLinks','submissions'];
const copy=x=>JSON.parse(JSON.stringify(x));
const logs=[];
function log(event,detail={}){const row={time:new Date().toISOString(),version:'261005_5',event,...detail};logs.push(row);if(logs.length>600)logs.shift();root.dispatchEvent?.(new Event('mirae-log'));}
function empty(){const d=Object.fromEntries(arrays.map(k=>[k,[]]));return Object.assign(d,{parentPasswords:{},mswitch:{},settings:{},timenet_meta:{},submissions:[],attachments:[],lesson_files:[]});}
function flatten(d){const map=new Map();for(const name of arrays)for(const row of d[name]||[]){if(!row.id)throw Error(name+': 저장할 항목의 ID가 없습니다.');map.set(name+'/'+row.id,copy(row))}for(const k of ['parentPasswords','mswitch','settings','timenet_meta','loginDesign','designRevision'])if(d[k]!==undefined)map.set('settings/'+k,copy(d[k]));return map}
function inflate(map){const d=empty();for(const [key,value]of map){const [kind,id]=key.split('/');if(arrays.includes(kind))d[kind].push(copy(value));else if(kind==='settings'&&['parentPasswords','mswitch','settings','timenet_meta','loginDesign','designRevision'].includes(id))d[id]=copy(value)}return d}
class Store{
 constructor(config={},transport){this.config=config;this.transport=transport;this.documents=new Map();this.revision=-1;this.queue=Promise.resolve()}
 configured(){return Boolean(this.config.SUPABASE_URL&&this.config.SUPABASE_KEY)}
 async rpc(name,body){
  if(this.transport)return this.transport(name,body);
  if(!this.configured())throw Error('연결 설정이 필요합니다. 관리자에게 문의해 주세요.');
  const base=new URL(this.config.SUPABASE_URL),key=String(this.config.SUPABASE_KEY).trim();
  if(base.protocol!=='https:')throw Error('Supabase 주소는 https://로 시작해야 합니다.');
  if(key.startsWith('sb_secret_'))throw Error('Secret 키는 사용할 수 없습니다. Publishable 또는 anon 키를 입력하세요.');
  const headers={'apikey':key,'Content-Type':'application/json'};
  if(key.startsWith('eyJ')){let claims;try{claims=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{throw Error('Supabase anon 키 형식을 확인해 주세요.')}if(claims.role!=='anon')throw Error('anon 키만 입력하세요. service_role 키는 사용할 수 없습니다.');headers.Authorization='Bearer '+key}
  const started=Date.now();log('supabase.request',{operation:name});
  let r;try{r=await fetch(base.origin+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000),credentials:'omit'})}catch(e){log('supabase.network_error',{operation:name,kind:e.name});throw Error('응답을 받지 못했습니다. 인터넷 연결을 확인해 주세요. 저장 중이었다면 다시 불러와 반영 여부를 먼저 확인하세요.')}
  let data;try{data=await r.json()}catch{throw Error('응답을 확인하지 못했습니다. 다시 시도해 주세요.')}
  const reason=['INVALID_DOCUMENT_KEY','INVALID_BATCH'].find(x=>String(data.message||'').includes(x));log('supabase.response',{operation:name,status:r.status,elapsed_ms:Date.now()-started,...(!r.ok?{code:String(data.code||'unknown'),reason:reason||'unclassified'}:{})});if(!r.ok&&reason)throw Error(reason==='INVALID_DOCUMENT_KEY'?'학생 저장 ID 형식이 데이터베이스 규칙과 맞지 않습니다. 사이트를 v261005_5으로 갱신한 뒤 저장만 다시 시도하세요.':'저장할 자료 묶음의 형식을 확인하세요. 기존 자료는 유지됩니다.');
  if(!r.ok&&name==='mirae_push_login'&&String(data.message||'').includes('PUSH_LOGIN_REQUIRED'))throw Error('아이디 또는 비밀번호가 일치하지 않습니다.');if(!r.ok){const known={CHAT_PHONE_INVALID:"전화번호 형식을 확인해 주세요.",CHAT_PHONE_CHANGED:"전화번호가 다른 화면에서 변경되었습니다. 닫았다가 다시 열어 주세요.",CONSULTATION_DELETE_FORBIDDEN:"이 상담을 삭제할 권한이 없습니다.",CONSULTATION_DELETE_INPUT:"삭제할 상담은 한 번에 200건까지 선택하세요.",PERSONAL_VIEW:"처음 보일 화면을 다시 선택해 주세요.",CONSULTATION_READ_FORBIDDEN:"이 상담을 확인할 권한이 없습니다.",CONSULTATION_CHANGED:"상담 내용이 변경되었습니다. 다시 열어 확인해 주세요.",UPDATES_FORBIDDEN:"업데이트 게시판은 임직원만 이용할 수 있습니다.",UPDATES_ADMIN_REQUIRED:"최고관리자만 게시물을 수정할 수 있습니다.",UPDATES_CONFLICT:"게시물이 변경되었습니다. 목록을 새로고침한 뒤 다시 수정해 주세요.",UPDATES_INPUT_INVALID:"제목과 내용을 확인해 주세요.",EXISTING_STUDENT_ID_LOCKED:'이미 등록된 학생은 기존 아이디를 유지합니다. 명단을 다시 불러와 주세요.',LOGIN_IN_USE:'이미 사용 중인 아이디입니다. 다른 아이디를 입력하세요.',LOGIN_INVALID:'아이디는 영문·숫자·한글과 . _ @ - 를 사용할 수 있습니다.',PASSWORD_REQUEST_CONFIRM_REQUIRED:'계정 사용 여부와 비밀번호 변경 요청을 확인해 주세요.',TEMPLATE_CHANGED:'TEMPLATE_CHANGED: 다른 사람이 문구를 수정했습니다. 화면을 다시 열어 주세요.',HOMEWORK_MAX_REQUIRED:'이번 수업의 과제 만점을 입력하세요.',HOMEWORK_MAX_BELOW_SAVED_SCORE:'이미 저장된 과제 점수보다 만점이 작습니다. 점수와 만점을 확인하세요.',HOMEWORK_SCORE_INVALID:'과제 점수는 이번 수업의 만점 이내로 입력하세요.',HOMEWORK_GRADE_INVALID:'과제 평가는 A·B·C·D·F 중에서 선택하세요.',CHAT_REQUEST_CONFLICT:'다시 보낼 메시지를 확인하세요.',PUSH_LOGIN_REQUIRED:'로그인이 만료되었습니다. 다시 로그인해 주세요.',PASSWORD_INVALID:'비밀번호는 4자 이상, 한글 기준 72바이트 이내로 입력하세요.',DUPLICATE_LOGIN_ID:'이미 사용 중인 아이디입니다.',ACCOUNTS_CHANGED:'계정 정보가 변경되었습니다. 새로고침한 뒤 다시 시도하세요.',ACCOUNTS_SCOPE:'담당 학생과 학부모만 관리할 수 있습니다.',VIDEO_SCOPE:'담당 강좌의 영상만 확인할 수 있습니다.',VIDEO_FORBIDDEN:'본인에게 배정된 강좌에만 영상을 등록할 수 있습니다.',VIDEO_CHANGED:'내 영상이 변경되었습니다. 다시 불러온 뒤 저장하세요.',VIDEO_LIMIT:'한 수업에 강사별 영상은 최대 3개입니다.',VIDEO_URL_INVALID:'YouTube 영상 주소를 확인하세요.',COURSE_TEAM_INVALID:'부담임은 최대 5명까지 지정하세요.',FAMILY_EVENT_INVALID:'제출 내용과 자료 주소를 확인하세요.',FAMILY_EVENT_SCOPE:'등록된 강좌에만 제출·신청할 수 있습니다.'};const item=Object.entries(known).find(([k])=>String(data.message||'').includes(k));if(item)throw Error(item[1]);}if(!r.ok)throw Error(['PGRST202','42P01','42883'].includes(data.code)?'연결 설정을 확인해야 합니다. 관리자에게 문의해 주세요.':'요청을 완료하지 못했습니다. 관리자에게 문의해 주세요.');
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
