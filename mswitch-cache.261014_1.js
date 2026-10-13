/* Last complete snapshot first. External collection is owned by the PC, not tabs. */
(()=>{'use strict';
let cfg={},owner='',generation=0,snapshot=null,pending=null,refreshing=null,starting=null,timer=null,lastRead=0,lastError='',collecting=false,serverOffset=0,retryAt=0,loginNeeded=false,loginTask=null,progressOp=null,waitReason='',nextAttempt=0,loginRetryAt=0,progressState={};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.1"/><path d="M10 5.8v4.5l3 1.8"/></svg>';
const now=()=>Date.now()+serverOffset;
function allowed(){return ['admin','teacher'].includes(cfg.user?.()?.role)&&(cfg.can?.('sms')||cfg.can?.('attendance_notify')||cfg.can?.('mswitch_contact'))}
function fresh(s=snapshot){const n=Date.parse(s?.fetched_at);return Number.isFinite(n)&&now()-n<1800000&&n<=now()+60000}
function reset(){generation++;owner='';snapshot=null;pending=null;refreshing=null;starting=null;lastRead=0;lastError='';collecting=false;serverOffset=0;retryAt=0;loginNeeded=false;loginTask=null;progressOp?.remove();progressOp=null;waitReason='';nextAttempt=0;loginRetryAt=0;progressState={};clearInterval(timer);timer=null;paint()}
function ensure(){const id=cfg.user?.()?.id||'';if(owner!==id){reset();owner=id}return owner}
function emit(){window.dispatchEvent(new CustomEvent('mirae-ms-cache',{detail:{snapshot,collecting,error:lastError}}));paint()}
function apply(r){if(r.account_changed){progressOp?.remove();progressOp=null}progressState=r.progress||{};waitReason=r.configured===false?'account_required':r.collecting&&r.collector_online===false?'collector_wait':r.wait_reason||'';if(r.server_time)serverOffset=Date.parse(r.server_time)-Date.now();lastRead=Date.now();collecting=!!r.collecting&&r.collector_online!==false;lastError=r.error||'';retryAt=Date.parse(r.retry_at)||0;const old=snapshot?.updated_at;if(!r.unchanged)snapshot=r.snapshot||null;if(snapshot)snapshot={...snapshot,_stale:r.fresh===false};if(r.fresh&&progressOp){if(!progressOp.finished)progressOp.done('완료');progressOp=null}if(old!==snapshot?.updated_at)emit();else paint();return r}
async function read(action='peek',data={}){const id=ensure(),g=generation;const r=await MiraePC.cacheCall(action,{known_updated_at:snapshot?.updated_at||'',...data});if(g!==generation||cfg.user?.()?.id!==id)throw Error('로그인 계정이 변경되었습니다.');return apply(r)}
async function get(kind='roster',onProgress){
 ensure();if(!allowed())throw Error('엠스위치를 사용할 권한이 없습니다.');
 if(snapshot&&!snapshot._stale&&fresh()&&snapshot[kind])return snapshot[kind];
 if(lastError&&retryAt>now()){if(snapshot?.[kind])return snapshot[kind];throw Error(lastError)}
 if(pending){const s=await pending;if(!s?.[kind])throw Error('이 계정의 명단을 확인할 수 없습니다.');return s[kind]}
 const id=owner,g=generation;
 const task=(async()=>{
  let r=await read('read');if(!r.configured)throw Error('개인설정에서 본인의 엠스위치 계정을 저장해 주세요.');
  if(r.fresh&&snapshot?.[kind])return snapshot;
  if(r.account_changed)throw Error('이 PC는 다른 계정으로 연결되어 있습니다. 사용할 계정으로 PC 사이트에 다시 로그인해 주세요.');
  // Only a missing/expired snapshot opens the familiar non-blocking progress UI.
  if(progressOp?.attached===false)progressOp=null;
  const op=onProgress?null:(progressOp||(progressOp=window.MiraeProgress?.begin('엠스위치 명단',{running:'엠스위치 · 최신 명단을 가져오는 중',done:'엠스위치 명단 준비 완료',failed:'엠스위치 명단 준비 대기'})));op?.resume();
  try{
   const end=Date.now()+13*60000;
   while(Date.now()<end){
    if(g!==generation||cfg.user?.()?.id!==id)throw Error('로그인 계정이 변경되었습니다.');
    if(r.fresh&&snapshot?.[kind]){if(op&&!op.finished)op.done('완료');if(progressOp===op)progressOp=null;return snapshot}
    if(r.account_changed)throw Error('이 PC는 다른 계정으로 연결되어 있습니다. 사용할 계정으로 PC 사이트에 다시 로그인해 주세요.');
    if(r.error&&!r.collecting&&retryAt>now())throw Error(r.error);
    if(loginNeeded&&Date.now()>=loginRetryAt){try{await renewLogin()}catch{}}
    if(!r.collecting&&MiraePC.state!=='connected'){
     if(!await MiraePC.connect(false))throw Error(MiraePC.state==='update'?'연결기 업데이트 후 자동으로 명단을 준비합니다.':snapshot?'PC 연결 후 명단이 자동 갱신됩니다. 마지막 자료를 표시합니다.':'연결기를 설치하거나 실행하면 첫 명단을 자동으로 가져옵니다.');
     await renewLogin();r=await read('read');
    }
    op?.update({...r.progress,status_text:statusText()});onProgress?.(r.progress||{stage:1});
    await new Promise(resolve=>setTimeout(resolve,1200));r=await read('peek');
   }
   throw Error('명단 수신을 완료하지 못했습니다. 기존 자료는 보관되어 있습니다.');
  }catch(e){if(g!==generation||cfg.user?.()?.id!==id){op?.remove();throw e}lastError=e.message;nextAttempt=Date.now()+15000;paint();if(waitReason==='pc_account_changed'){op?.remove();if(progressOp===op)progressOp=null}else{op?.fail(e.message);op?.setDetail?.(e.message);}if(snapshot?.[kind])return snapshot;throw e}
 })();pending=task;
 try{const s=await task;if(!s?.[kind])throw Error('명단을 확인하지 못했습니다.');return s[kind]}finally{if(pending===task)pending=null}
}
// A user-requested refresh must never resolve with the old/stale fallback.
async function refresh(onProgress){
 ensure();if(!allowed()||!cfg.can?.('mswitch_contact'))throw Error('연락처 갱신 권한이 없습니다.');
 if(refreshing)return refreshing;
 const id=owner,g=generation,previous=snapshot?.updated_at;
 const valid=()=>{if(g!==generation||cfg.user?.()?.id!==id)throw Error('로그인 계정이 변경되었습니다.');};
 const task=(async()=>{
  if(!await MiraePC.connect(false))throw Error(MiraePC.state==='update'?'연결기를 업데이트한 뒤 다시 갱신해 주세요.':'본인 계정으로 연결된 PC를 실행한 뒤 다시 갱신해 주세요.');
  valid();let r=await read('read',{force_refresh:true});
  if(!r.configured)throw Error('개인설정에서 본인의 엠스위치 계정을 저장해 주세요.');
  if(r.manual_refresh_protocol!==1)throw Error('연락처 갱신용 SQL53 적용이 필요합니다.');
  const end=Date.now()+13*60000;
  while(Date.now()<end){
   valid();
   if(r.account_changed)throw Error('이 PC는 다른 계정으로 연결되어 있습니다. PC에서 본인 계정으로 다시 로그인해 주세요.');
   if(r.fresh&&snapshot?.contacts&&snapshot?.roster&&snapshot.updated_at!==previous&&!snapshot._stale){onProgress?.({stage:4,phase:'validating',status_text:'최신 연락처 확인 완료'});return snapshot;}
   if(r.error&&!r.collecting)throw Error(r.error);
   if(!r.pc_configured||!r.pc_online&&!r.collecting)throw Error('PC 연결이 끊겼습니다. 기존 자료를 유지합니다. PC 연결 후 다시 갱신해 주세요.');
   onProgress?.({...r.progress,status_text:statusText()});
   await new Promise(resolve=>setTimeout(resolve,1200));r=await read('peek');
  }
  throw Error('최신 연락처 수신을 완료하지 못했습니다. 기존 자료를 유지합니다. 다시 갱신해 주세요.');
 })();refreshing=task;
 try{return await task}catch(e){if(g===generation){lastError=e.message;paint()}throw e}finally{if(refreshing===task)refreshing=null}
}
async function renewLogin(){
 if(!loginNeeded||Date.now()<loginRetryAt)return;if(loginTask)return loginTask;const g=generation,id=owner;loginRetryAt=Date.now()+15000;
 const task=(async()=>{const r=await MiraePC.cacheLogin();if(g!==generation||cfg.user?.()?.id!==id)return;
  loginNeeded=r?.pc_registered===false&&!r?.account_changed;
 })();loginTask=task;try{await task}finally{if(loginTask===task)loginTask=null}
}
function statusText(){
 if(waitReason==='pc_account_changed')return 'PC 계정 변경됨 · PC에서 본인 계정으로 다시 로그인';
 if(waitReason==='collector_wait')return '수집 PC 응답 대기 · 연결을 다시 확인하고 있습니다.';
 if(collecting)return progressState.phase==='validating'||Number(progressState.stage)>=4?'수신 자료 확인중':progressState.phase==='receiving'||Number(progressState.stage)>=2?'연결완료 · 수신중':'엠스위치 연결중';
 if(waitReason==='account_required')return '개인설정에서 엠스위치 계정을 저장해 주세요.';
 if(MiraePC.state==='update'||waitReason==='pc_update')return '연결기 업데이트 대기';
 if(['pc_missing','pc_offline'].includes(waitReason)||['offline','limited'].includes(MiraePC.state))return 'PC 연결 대기 · 연결되면 자동 수집';
 if(waitReason==='write_pending')return '문자·연락처 저장 완료 후 자동 수집';
 if(retryAt>now())return '자동 재시도 대기';
 return snapshot?'최신 명단 준비중 · PC에 수집 요청':'첫 명단 준비중 · PC에 수집 요청';
}
function showWait(error){
 if(['account_required','pc_account_changed'].includes(waitReason)||snapshot&&fresh()&&!snapshot._stale)return;
 if(progressOp?.attached===false)progressOp=null;
 if(!progressOp)progressOp=window.MiraeProgress?.begin('엠스위치 명단',{running:'엠스위치 명단 준비',failed:'엠스위치 명단 준비 대기'});
 progressOp?.fail(error.message);progressOp?.setDetail?.(error.message);
}
async function tick(){
 if(!allowed()||document.hidden||pending||refreshing||starting||Date.now()<nextAttempt)return;
 if(!loginNeeded&&snapshot&&!snapshot._stale&&fresh()&&Date.now()-lastRead<30000)return;
 const g=generation;
 try{await renewLogin();if(g!==generation)return;const r=await read('read');if(!r.fresh&&r.configured&&!(retryAt>now()&&!r.collecting))await get('roster');}
 catch(e){if(g!==generation)return;lastError=e.message;nextAttempt=Date.now()+15000;paint();showWait(e);}
}
async function start(renew=false){
 ensure();if(!allowed())return;if(renew){loginNeeded=true;loginRetryAt=0}
 if(!timer)timer=setInterval(tick,10000);
 if(starting)return starting;const g=generation;
 const task=(async()=>{
  // A transient login-binding failure must not abandon all subsequent reads.
  try{await renewLogin()}catch(e){if(g===generation){lastError=e.message;paint()}}
  if(g!==generation)return;
  try{await get('roster');if(cfg.can?.('mswitch_contact'))await get('contacts')}
  catch(e){if(g===generation){lastError=e.message;nextAttempt=Date.now()+15000;paint();showWait(e);window.MiraeStore?.log('mswitch.cache_wait',{message:e.message})}}
 })();starting=task;try{return await task}finally{if(starting===task)starting=null}
}
window.addEventListener('mirae-pc-state',e=>{paint();if(e.detail?.state==='connected'){nextAttempt=0;if(owner&&allowed())void start()}});
window.addEventListener('online',()=>{nextAttempt=0;if(owner&&allowed())void start()});
function describe(kind='roster'){
 const stamp=snapshot?.[kind]?.fetched_at||snapshot?.fetched_at,n=Date.parse(stamp),age=now()-n;
 if(!Number.isFinite(n))return{text:waitReason==='pc_account_changed'?'PC 계정 변경됨':waitReason==='account_required'?'계정 설정 필요':collecting?(Number(progressState.stage)>=2?'명단 수신중':'엠스위치 연결중'):waitReason==='collector_wait'?'수집 응답 대기':MiraePC.state==='update'||waitReason==='pc_update'?'연결기 업데이트':retryAt>now()?'자동 재시도 대기':['offline','limited'].includes(MiraePC.state)?'PC 연결 대기':lastError?'연결 확인 필요':'명단 준비중',state:collecting?'loading':lastError?'warning':'loading',title:statusText()+(lastError?' · '+lastError:'')};
 const minutes=Math.max(0,Math.floor(age/60000)),label=minutes<1?'방금':minutes<60?minutes+'분 전':minutes<1440?Math.floor(minutes/60)+'시간 전':Math.floor(minutes/1440)+'일 전';
 const stale=snapshot?._stale||age>=1800000;
 return{text:label+' 자료'+(collecting?' · 갱신중':stale?' · 갱신 대기':''),state:collecting?'loading':stale?'warning':'fresh',title:'엠스위치 '+(kind==='contacts'?'연락처':'문자 수신 명단')+' · '+new Date(n).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+(collecting?' · 갱신중':lastError?' · '+lastError:stale?' · 최신 자료 대기':' · 10분마다 자동 갱신')};
}
function html(kind='roster'){if(!allowed()||kind==='contacts'&&!cfg.can?.('mswitch_contact'))return'';const d=describe(kind);return'<span class="ms-cache-badge" data-ms-cache-age="'+esc(kind)+'" data-state="'+d.state+'" title="'+esc(d.title)+'" aria-label="'+esc(d.title)+'">'+clock+'<span>'+esc(d.text)+'</span></span>'}
function paint(){document.querySelectorAll('[data-ms-cache-age]').forEach(el=>{const d=describe(el.dataset.msCacheAge);el.dataset.state=d.state;el.title=d.title;el.setAttribute('aria-label',d.title);const text=el.querySelector('span');if(text&&text.textContent!==d.text)text.textContent=d.text})}
document.addEventListener('visibilitychange',()=>{paint();if(!document.hidden&&owner&&allowed()&&Date.now()-lastRead>30000)void start()});
window.MiraeMSCache={configure(c){cfg=c},get,refresh,get refreshing(){return !!refreshing},get snapshot(){return cfg.user?.()?.id===owner?snapshot:null},fresh,html,paint,start,reset,statusText,get collecting(){return collecting},async changed(){reset();return start(true)},async afterWrite(onProgress){return (await refresh(onProgress)).roster}};
})();
