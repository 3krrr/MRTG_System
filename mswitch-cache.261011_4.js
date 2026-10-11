/* Last complete snapshot first. External collection is owned by the PC, not tabs. */
(()=>{'use strict';
let cfg={},owner='',generation=0,snapshot=null,pending=null,starting=null,timer=null,lastRead=0,lastError='',collecting=false,serverOffset=0,retryAt=0;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.1"/><path d="M10 5.8v4.5l3 1.8"/></svg>';
const now=()=>Date.now()+serverOffset;
function allowed(){return ['admin','teacher'].includes(cfg.user?.()?.role)&&(cfg.can?.('sms')||cfg.can?.('attendance_notify')||cfg.can?.('mswitch_contact'))}
function fresh(s=snapshot){const n=Date.parse(s?.fetched_at);return Number.isFinite(n)&&now()-n<1800000&&n<=now()+60000}
function reset(){generation++;owner='';snapshot=null;pending=null;starting=null;lastRead=0;lastError='';collecting=false;serverOffset=0;retryAt=0;clearInterval(timer);timer=null;paint()}
function ensure(){const id=cfg.user?.()?.id||'';if(owner!==id){reset();owner=id}return owner}
function emit(){window.dispatchEvent(new CustomEvent('mirae-ms-cache',{detail:{snapshot,collecting,error:lastError}}));paint()}
function apply(r){if(r.server_time)serverOffset=Date.parse(r.server_time)-Date.now();lastRead=Date.now();collecting=!!r.collecting;lastError=r.error||'';retryAt=Date.parse(r.retry_at)||0;const old=snapshot?.updated_at;if(!r.unchanged)snapshot=r.snapshot||null;if(snapshot&&r.fresh===false)snapshot={...snapshot,_stale:true};if(old!==snapshot?.updated_at)emit();else paint();return r}
async function read(action='peek'){const id=ensure(),g=generation;const r=await MiraePC.cacheCall(action,{known_updated_at:snapshot?.updated_at||''});if(g!==generation||cfg.user?.()?.id!==id)throw Error('로그인 계정이 변경되었습니다.');return apply(r)}
async function get(kind='roster',onProgress){
 ensure();if(!allowed())throw Error('엠스위치를 사용할 권한이 없습니다.');
 if(snapshot&&!snapshot._stale&&fresh()&&snapshot[kind])return snapshot[kind];
 if(lastError&&retryAt>now()){if(snapshot?.[kind])return snapshot[kind];throw Error(lastError)}
 if(pending){const s=await pending;if(!s?.[kind])throw Error('이 계정의 명단을 확인할 수 없습니다.');return s[kind]}
 const id=owner,g=generation;
 const task=(async()=>{
  let r=await read('read');if(!r.configured)throw Error('개인설정에서 본인의 엠스위치 계정을 저장해 주세요.');
  if(r.fresh&&snapshot?.[kind])return snapshot;
  // Only a missing/expired snapshot opens the familiar non-blocking progress UI.
  const op=onProgress?null:window.MiraeProgress?.begin('엠스위치 명단',{running:'엠스위치 · 최신 명단을 가져오는 중',done:'엠스위치 명단 준비 완료',failed:'엠스위치 연결 확인 필요'});
  try{
   const end=Date.now()+13*60000;
   while(Date.now()<end){
    if(g!==generation||cfg.user?.()?.id!==id)throw Error('로그인 계정이 변경되었습니다.');
    if(r.fresh&&snapshot?.[kind]){op?.done('완료');return snapshot}
    if(r.error&&!r.collecting)throw Error(r.error);
    if(!r.collecting&&MiraePC.state!=='connected'){
     if(!await MiraePC.connect(false))throw Error(snapshot?'PC 연결 후 명단이 자동 갱신됩니다. 마지막 자료를 표시합니다.':'첫 명단을 준비하려면 PC 연결기를 실행해 주세요.');
    }
    op?.update(r.progress||{stage:1,label:'연결 확인중'});onProgress?.(r.progress||{stage:1});
    await new Promise(resolve=>setTimeout(resolve,1200));r=await read('peek');
   }
   throw Error('명단 수신을 완료하지 못했습니다. 기존 자료는 보관되어 있습니다.');
  }catch(e){if(g!==generation||cfg.user?.()?.id!==id){op?.remove();throw e}lastError=e.message;paint();op?.fail(e.message);if(snapshot?.[kind])return snapshot;throw e}
 })();pending=task;
 try{const s=await task;if(!s?.[kind])throw Error('명단을 확인하지 못했습니다.');return s[kind]}finally{if(pending===task)pending=null}
}
async function start(renew=false){
 ensure();if(!allowed())return;if(starting)return starting;const g=generation;
 const task=(async()=>{
  try{if(renew)await MiraePC.cacheLogin();if(g!==generation)return;await get('roster');if(cfg.can?.('mswitch_contact'))await get('contacts')}
  catch(e){if(g===generation){lastError=e.message;paint();window.MiraeStore?.log('mswitch.cache_wait',{message:e.message})}}
  if(g!==generation)return;
  if(!timer)timer=setInterval(async()=>{if(!allowed()||document.hidden||pending)return;try{const r=await read('read');if(!r.fresh&&!r.collecting&&!r.error)void get('roster').catch(()=>{})}catch{}},30000);
 })();starting=task;try{return await task}finally{if(starting===task)starting=null}
}
function describe(kind='roster'){
 const stamp=snapshot?.[kind]?.fetched_at||snapshot?.fetched_at,n=Date.parse(stamp),age=now()-n;
 if(!Number.isFinite(n))return{text:lastError?'연결 확인':'명단 준비중',state:lastError?'warning':'loading',title:lastError||'첫 엠스위치 명단을 준비하고 있습니다.'};
 const minutes=Math.max(0,Math.floor(age/60000)),label=minutes<1?'방금':minutes<60?minutes+'분 전':minutes<1440?Math.floor(minutes/60)+'시간 전':Math.floor(minutes/1440)+'일 전';
 const stale=snapshot?._stale||age>=1800000;
 return{text:label+' 자료',state:stale?'warning':'fresh',title:'엠스위치 '+(kind==='contacts'?'연락처':'문자 수신 명단')+' · '+new Date(n).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+(collecting?' · 갱신중':lastError?' · '+lastError:stale?' · 최신 자료 대기':' · 10분마다 자동 갱신')};
}
function html(kind='roster'){if(!allowed()||kind==='contacts'&&!cfg.can?.('mswitch_contact'))return'';const d=describe(kind);return'<span class="ms-cache-badge" data-ms-cache-age="'+esc(kind)+'" data-state="'+d.state+'" title="'+esc(d.title)+'" aria-label="'+esc(d.title)+'">'+clock+'<span>'+esc(d.text)+'</span></span>'}
function paint(){document.querySelectorAll('[data-ms-cache-age]').forEach(el=>{const d=describe(el.dataset.msCacheAge);el.dataset.state=d.state;el.title=d.title;el.setAttribute('aria-label',d.title);const text=el.querySelector('span');if(text&&text.textContent!==d.text)text.textContent=d.text})}
document.addEventListener('visibilitychange',()=>{paint();if(!document.hidden&&owner&&allowed()&&Date.now()-lastRead>30000)void start()});
window.MiraeMSCache={configure(c){cfg=c},get,get snapshot(){return cfg.user?.()?.id===owner?snapshot:null},fresh,html,paint,start,reset,async changed(){reset();return start(true)},async afterWrite(onProgress){ensure();snapshot=null;lastRead=0;return get('roster',onProgress)}};
})();
