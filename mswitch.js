/* MSwitch operations run in the paired PC connector via Supabase HTTPS jobs. */
(()=>{'use strict';
const LOGIN='https://mswitch.t-ime.com',REMOTE='https://pmams.t-ime.com',SMS='/sms/SmsSendMngtN/';
let cfg={},meta=null,owner='',generation=0,selected=new Map(),busy=false,blockedSend=false,lastAuto='',pending=null,roster=null;
const $=(s,r=document)=>r.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),digits=s=>String(s||'').replace(/\D/g,''),log=(event,d={})=>window.MiraeStore.log('mswitch.'+event,d);
function official(){return '<a class="btn" href="https://mswitch.t-ime.com/login.do" target="_blank" rel="noopener noreferrer">엠스위치 공식 사이트 열기</a>'}
function logsHTML(){return '<p>PC 처리 결과와 오류를 아래에 기록합니다. 오류 문의 시 로그를 복사해 주세요.</p><textarea class="v2-log msw-log" readonly aria-label="엠스위치 로그"></textarea><button class="btn" data-msw-copy>로그 복사</button> <button class="btn" data-msw-save-log>텍스트 파일 저장</button>'}
function bindLogs(root){const area=$('.msw-log',root);const paint=()=>{if(area.isConnected){area.value=window.MiraeStore.logs();area.scrollTop=area.scrollHeight}else window.removeEventListener('mirae-log',paint)};paint();window.addEventListener('mirae-log',paint);$('[data-msw-copy]',root).onclick=async()=>{try{await navigator.clipboard.writeText(area.value);cfg.toast('복사했습니다.')}catch{area.focus();area.select();cfg.toast('Ctrl+C로 복사하세요.')}};$('[data-msw-save-log]',root).onclick=()=>{const u=URL.createObjectURL(new Blob([area.value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='mirae-v2-mswitch-log.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}}
async function credentials(){const id=cfg.user()?.id,g=generation,c=await cfg.api('/api/mswitch/credentials');if(id!==cfg.user()?.id||g!==generation)throw Error('사이트 계정이 변경되어 작업을 중단했습니다.');if(!c.username||!c.password)throw Error('개인설정 → 엠스위치 연동에서 본인 계정을 저장해 주세요.');return {...c,_site_owner:id}}
async function connect(c,keepSelection=false){const g=generation,id=cfg.user()?.id;if(!id||c._site_owner!==id)throw Error('사이트 계정이 변경되어 작업을 중단했습니다.');if(!keepSelection||owner!==id){selected.clear();roster=null;}const d=await window.MiraePC.run('mswitch.login',c);if(g!==generation||id!==cfg.user()?.id)throw Error('로그인한 사이트 계정이 변경되었습니다.');meta={...d.meta,until:Date.now()+15*60000};owner=id;return meta}
async function connectSaved(keepSelection=false){if(pending)return pending;pending=(async()=>{const c=await credentials();return connect(c,keepSelection)})();try{return await pending}finally{pending=null}}
async function ready(force=false){if(force||!meta||owner!==cfg.user()?.id||meta.until<Date.now())await connectSaved(true);return meta}
async function mountLink(root,message=''){
 root.innerHTML='<p><b>내 엠스위치 계정 연결</b> · 이 PC의 프로그램이 로그인과 문자 발송을 처리합니다. 사용자마다 자신의 계정을 사용합니다.</p><form class="msw-link-form"><label class="field">엠스위치 아이디<input name="username" autocomplete="username" required></label><label class="field">엠스위치 비밀번호<input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" type="submit">저장 · 연동하기</button> <button class="btn" type="button" data-msw-diag>비밀번호 없이 연결 진단</button> <button class="btn" type="button" data-msw-remove>저장 계정 삭제</button></form><p class="msw-result" role="status"></p>'+official()+logsHTML();bindLogs(root);const result=$('.msw-result',root),form=$('.msw-link-form',root),linkOwner=cfg.user()?.id,linkGeneration=generation,controls=[...form.querySelectorAll('input,button')];controls.forEach(el=>el.disabled=true);result.textContent=message||'저장한 엠스위치 계정을 확인하는 중…';
 try{const c=await cfg.api('/api/mswitch/credentials');if(!form.isConnected||linkOwner!==cfg.user()?.id||linkGeneration!==generation)return;if(root.isConnected){$('[name=username]',root).value=c.username||'';$('[name=password]',root).value=c.password||'';if(!message)result.textContent=c.username?'이 사이트 사용자에게 계정이 저장되어 있습니다. 현재 탭에서 연동을 확인하세요.':'저장된 엠스위치 계정이 없습니다.'}}catch(e){result.textContent=e.message}
 $('.msw-link-form',root).onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const b=$('[type=submit]',root);b.disabled=true;result.textContent='계정 저장 및 로그인 확인 중…';try{const c={username:$('[name=username]',root).value.trim(),password:$('[name=password]',root).value,_site_owner:cfg.user()?.id};await cfg.api('/api/mswitch/credentials',{method:'POST',body:c});const m=await connect(c);result.textContent=m.name+'님, 실제 엠스위치 로그인을 확인했습니다.';cfg.changed?.()}catch(err){result.textContent='계정 저장 후 연동 확인 실패: '+err.message;log('link.failed',{message:err.message})}finally{busy=false;b.disabled=false}};
 $('[data-msw-remove]',root).onclick=async()=>{if(busy)return;try{await cfg.api('/api/mswitch/credentials',{method:'POST',body:{remove:true}});reset();$('[name=username]',root).value='';$('[name=password]',root).value='';result.textContent='저장된 계정을 삭제했습니다.'}catch(e){result.textContent=e.message}};
 $('[data-msw-diag]',root).onclick=async()=>{if(busy)return;busy=true;result.textContent='PC에서 연결 진단 중…';try{const d=await window.MiraePC.run('mswitch.diagnostics');result.textContent=d.results.map(x=>x.host+' · '+(x.ok?'연결 성공':'연결 실패')).join('\n')}catch(e){result.textContent=e.message}finally{busy=false}};
 if(form.isConnected&&linkOwner===cfg.user()?.id&&linkGeneration===generation)controls.forEach(el=>el.disabled=false);
}
async function mount(root){
 selected.clear();root.innerHTML='<h1>문자보내기</h1><p>PC 연결과 엠스위치 로그인이 확인되면 학부모에게 문자를 보낼 수 있습니다.</p><button class="btn" data-msw-link>엠스위치 연동</button> '+official()+'<div class="msw-result" role="status"></div><div class="v2-sms-grid"><section class="section"><h2>받는 학부모</h2><div class="msw-roster-tools"><button class="btn primary" data-msw-load>학생 명단 불러오기</button><input name="keyword" class="input" placeholder="불러온 명단에서 학생명·번호 검색" aria-label="학생명·번호 검색"></div><p data-msw-loaded class="muted"></p><div class="msw-directory" data-msw-results></div><p data-msw-count>학생 0명 · 학부모 0명</p></section><section class="section"><h2>문자 내용</h2><label class="field">종류<select name="mode"><option value="info">정보성</option><option value="ad">광고성 · (광고) 자동 추가</option></select></label><label class="field">발송 경로<select name="channels"><option value="har">HAR 기준 · SMS/앱/알림톡</option><option value="sms">SMS만</option></select></label><label class="field">발신번호<select name="sender"><option value="">연동 후 불러옵니다</option></select></label><textarea name="message" class="v2-message" maxlength="2000" placeholder="문자 내용을 입력하세요"></textarea><button class="btn primary" data-msw-send>발송</button><button class="btn" data-msw-unlock hidden>발송내역 확인 완료 · 새 발송 준비</button><p>엠스위치에 없는 수신자는 공식 사이트에서 직접 입력해 주세요. 필수 학생 식별값을 임의로 만들지 않습니다.</p></section></div>'+logsHTML();bindLogs(root);
 const result=$('.msw-result',root),renderSenders=()=>{if(meta)$('[name=sender]',root).innerHTML=meta.replies.map(p=>'<option>'+p+'</option>').join('')};renderSenders();result.textContent=meta?meta.name+'님 · PC에서 로그인 확인됨':'현재 엠스위치 연결이 확인되지 않았습니다.';
 $('[data-msw-link]',root).onclick=()=>cfg.openLink();

 function display(){
  if(!root.isConnected)return;
  const q=$('[name=keyword]',root).value.trim().toLowerCase(),all=roster?.rows||[],rows=all.filter(x=>!q||x.name.toLowerCase().includes(q)||x.phone.includes(q));
  const withPhone=new Set(all.map(x=>String(x.raw.CMEM_SEQ))),missing=(roster?.students||[]).filter(x=>!withPhone.has(x.key)&&(!q||x.name.toLowerCase().includes(q)));
  $('[data-msw-results]',root).innerHTML=rows.map((x,i)=>`<label class="v2-recipient"><input type="checkbox" data-recipient="${i}" ${selected.has(x.key)?'checked':''}>${esc(x.name)} · 학부모 ${x.slot==='2'?2:1} · ${esc(x.phone)}</label>`).join('')+missing.map(x=>`<div class="msw-no-phone">${esc(x.name)} · 발송 가능한 학부모 연락처 없음</div>`).join('')|| (roster?'일치하는 학생이 없습니다.':'학생 명단 불러오기를 누르면 전체 명단을 가져옵니다.');
  root.querySelectorAll('[data-recipient]').forEach(el=>el.onchange=()=>{const x=rows[+el.dataset.recipient];el.checked?selected.set(x.key,x):selected.delete(x.key);$('[data-msw-count]',root).textContent='학생 0명 · 학부모 '+selected.size+'명'});
  $('[data-msw-count]',root).textContent='학생 0명 · 학부모 '+selected.size+'명';
  $('[data-msw-loaded]',root).textContent=roster?'전체 학생 '+roster.student_count+'명 · 학부모 연락처 '+all.length+'개 · '+new Date(roster.fetched_at).toLocaleString('ko-KR')+'에 불러옴 · 이 탭에서 검색':'이름 검색은 명단을 받은 후 바로 처리됩니다.';
 }
 $('[name=keyword]',root).addEventListener('input',display);display();
 $('[data-msw-load]',root).onclick=async()=>{
  if(busy)return;const op=window.MiraeProgress.begin('엠스위치 전체 학생 명단');if(!op)return;
  busy=true;const id=cfg.user()?.id,g=generation,button=$('[data-msw-load]',root);button.disabled=true;
  try{
   const d=await window.MiraePC.run('mswitch.roster',{...await credentials()},{onProgress:p=>op.update(p)});
   if(id!==cfg.user()?.id||g!==generation)return;
   if(!Array.isArray(d.rows)||!Array.isArray(d.students)||d.students.length!==d.student_count)throw Error('전체 명단의 수신 수량이 맞지 않습니다. 기존 명단은 유지합니다.');
   op.update({stage:5,label:'받은 전체 명단을 화면에 적용',done:d.student_count,total:d.student_count,unit:'학생'});
   roster=d;selected.clear();meta={...d.meta,until:Date.now()+15*60000};owner=id;
   if(root.isConnected){renderSenders();display();result.textContent='전체 학생 '+d.student_count+'명 수신 완료. 위 입력란에서 바로 검색하세요.'}
   log('roster.complete',{students:d.student_count,parents:d.rows.length});op.done('전체 학생 '+d.student_count+'명 · 명단 준비 완료');
  }catch(e){if(id===cfg.user()?.id&&g===generation){result.textContent=e.message;log('roster.failed',{message:e.message});op.fail(e.message)}}finally{busy=false;button.disabled=false}
 };
 $('[data-msw-send]',root).onclick=async()=>{if(busy||blockedSend)return;const button=$('[data-msw-send]',root),sendOwner=cfg.user()?.id,sendGeneration=generation;busy=true;button.disabled=true;let attempted=false;try{const m=await ready(),content=$('[name=message]',root).value.trim();if(!content||!selected.size||selected.size>100)throw Error('문자 내용과 학부모 1~100명을 선택하세요.');const sender=$('[name=sender]',root).value;if(!m.replies.includes(sender))throw Error('발신번호를 선택하세요.');if(!confirm('선택한 학부모 '+selected.size+'명에게 실제 문자를 발송할까요?'))return;busy=true;button.disabled=true;
 if(sendOwner!==cfg.user()?.id||sendGeneration!==generation||owner!==sendOwner)throw Error('사이트 계정이 변경되어 발송을 중단했습니다.');attempted=true;blockedSend=true;sessionStorage.setItem('mirae-v2-send-pending','1');log('send.started',{parents:selected.size,students:0});const d=await window.MiraePC.run('mswitch.send',{...await credentials(),selected:[...selected.values()],sender,message:content,mode:$('[name=mode]',root).value,channels:$('[name=channels]',root).value});result.textContent=d.message;
 }catch(e){result.textContent=attempted?'발송 결과 확인 불가. 이미 접수됐을 수 있으므로 공식 사이트 발송내역을 먼저 확인하세요.':e.message;log('send.failed',{attempted,message:attempted?'발송 결과 확인 불가':e.message})}finally{busy=false;button.disabled=blockedSend;$('[data-msw-unlock]',root).hidden=!blockedSend}};
 if(sessionStorage.getItem('mirae-v2-send-pending')){blockedSend=true;$('[data-msw-send]',root).disabled=true;$('[data-msw-unlock]',root).hidden=false;result.textContent='이 탭에서 이전 발송을 시도했습니다. 공식 사이트 발송내역을 확인하고 새 발송을 준비하세요.'}
 $('[data-msw-unlock]',root).onclick=()=>{if(!confirm('공식 엠스위치 발송내역을 확인했고, 새로운 발송을 준비할까요?'))return;sessionStorage.removeItem('mirae-v2-send-pending');blockedSend=false;selected.clear();display();$('[data-msw-count]',root).textContent='학생 0명 · 학부모 0명';$('[data-msw-send]',root).disabled=false;$('[data-msw-unlock]',root).hidden=true;result.textContent='학생을 다시 검색해서 선택하세요.'};
}
function reset(){generation++;roster=null;meta=null;owner='';selected.clear();lastAuto='';}
async function auto(){const u=cfg.user?.();if(!u||['parent','student'].includes(u.role)||lastAuto===u.id||window.MiraePC?.state!=='connected')return;lastAuto=u.id;try{const g=generation,c=await cfg.api('/api/mswitch/credentials');if(g!==generation||u.id!==cfg.user()?.id||!c.username)return;await connect({...c,_site_owner:u.id})}catch(e){if(u.id!==cfg.user()?.id)return;log('auto.failed',{message:e.message});cfg.openLink('엠스위치와의 자동 연동이 해지된 상태입니다. 다시 연동해주세요. '+e.message)}}
let rosterPending=null;
async function getRoster(force=false,onProgress){
 const c=await credentials(),id=cfg.user()?.id,g=generation;
 if(!force&&roster&&owner===id&&roster.account_username===c.username)return roster;
 if(rosterPending)return rosterPending;
 rosterPending=(async()=>{const d=await window.MiraePC.run('mswitch.roster',c,{onProgress});if(id!==cfg.user()?.id||g!==generation)throw Error('로그인 계정이 바뀌었습니다.');if(!Array.isArray(d.rows)||!Array.isArray(d.students)||d.student_count!==d.students.length)throw Error('전체 학생 명단의 수량을 확인하지 못했습니다.');roster={...d,account_username:c.username};meta={...d.meta,until:Date.now()+15*60000};owner=id;return roster})();try{return await rosterPending}finally{rosterPending=null}
}
async function sendAttendance(items,requestId,onProgress,expectedAccount){
 if(busy)throw Error('엠스위치에서 다른 작업을 처리 중입니다. 잠시 후 대기 알림 보내기를 눌러 주세요.');
 busy=true;try{const c=await credentials();if(expectedAccount&&expectedAccount!==c.username)throw Error('출결 저장 당시 엠스위치 계정과 현재 계정이 다릅니다.');return await window.MiraePC.run('mswitch.attendance',{...c,items},{requestId,onProgress})}finally{busy=false}
}
window.MiraeSMS={configure(c){cfg=c},mount,mountLink,auto,reset,getRoster,sendAttendance};
})();
