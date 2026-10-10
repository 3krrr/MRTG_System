(()=>{'use strict';
const P=window.MiraePush,E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds={withdrawal_review:'퇴원 승인 요청',withdrawal_ready:'퇴원 처리 요청',withdrawal_rejected:'퇴원보고 반려',withdrawal_processed:'퇴원 처리 완료',report:'수업 레포트',task:'업무 공유',transfer:'학생 이동',staff_chat:'직원 메신저',attendance:'출결 안내',reminder:'출결 확인',homework:'과제 안내',consultation:'상담 안내',manual:'안내'};
const time=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const symbol='<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>';
let unread=0,loading=null;
async function refresh(){if(loading)return loading;loading=(async()=>{try{await P.ensureSession();const r=await P.rpc('inbox',{limit:1});unread=r.unread;document.querySelectorAll('[data-inbox-count]').forEach(b=>{b.textContent=unread>99?'99+':unread;b.hidden=!unread})}catch{document.querySelectorAll('[data-inbox-count]').forEach(b=>b.hidden=true)}finally{loading=null}})();return loading}
function linkFor(x){try{const u=new URL(x.url,location.href);if(u.origin===location.origin&&['http:','https:'].includes(u.protocol))return u}catch{}return null}
async function open(){if(document.querySelector('[data-inbox-overlay]'))return;
 const box=document.createElement('div');box.className='modal-overlay';box.dataset.inboxOverlay='';
 box.innerHTML='<section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="inbox-title"><header class="modal-head"><h2 id="inbox-title">받은 알림</h2><button class="btn" data-close>닫기</button></header><div class="modal-body"><div class="inbox-summary"><button class="btn sm" data-all-read>모두 읽음</button><div class="platform-summary" data-inbox-status role="status">알림을 확인하고 있습니다.</div></div><div class="inbox-notification-list" data-inbox-list></div><div class="compact-filters inbox-pages"><button class="btn sm" data-prev>이전</button><span data-page></span><button class="btn sm" data-next>다음</button></div></div></section>';
 document.body.append(box);const previous=document.activeElement;let offset=0,total=0,request=0,detail=null,detailID='',reading=false;
 const closeDetail=()=>{detail?.remove();detail=null;box.querySelector('[data-inbox-message="'+CSS.escape(detailID)+'"]')?.focus()};
 const close=()=>{detail?.remove();box.remove();document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();refresh()};
 const key=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();e.preventDefault();detail?closeDetail():close()}};
 document.addEventListener('keydown',key);box.querySelector('[data-close]').onclick=close;box.querySelector('[data-close]').focus();
 box.querySelector('[data-prev]').onclick=()=>{offset=Math.max(0,offset-30);load()};box.querySelector('[data-next]').onclick=()=>{offset+=30;load()};
 box.querySelector('[data-all-read]').onclick=async()=>{try{await P.rpc('inbox_read',{id:'all'});await load();refresh()}catch(e){box.querySelector('[data-inbox-status]').textContent=e.message}};
 async function readMessage(x){if(reading||detail)return;reading=true;try{await P.rpc('inbox_read',{id:x.id});if(!box.isConnected)return;await load();if(!box.isConnected)return;refresh();
  detailID=x.id;detail=document.createElement('div');detail.className='modal-overlay inbox-letter-overlay';detail.dataset.inboxDetail='';
  detail.innerHTML='<section class="modal inbox-letter-modal" role="dialog" aria-modal="true" aria-labelledby="inbox-letter-title"><header class="modal-head"><span class="inbox-letter-icon">'+symbol+'</span><div><span class="inbox-letter-kind">'+E(kinds[x.kind]||'알림')+'</span><h2 id="inbox-letter-title">'+E(x.title)+'</h2></div><button class="btn" data-close>닫기</button></header><div class="modal-body"><dl class="inbox-letter-meta"><div><dt>보낸 사람</dt><dd>'+E(x.sender_name||'미래탐구')+'</dd></div><div><dt>받는 사람</dt><dd>'+E(x.recipient_name||'나')+'</dd></div><div><dt>받은 시각</dt><dd>'+E(time(x.received_at||x.created_at))+'</dd></div></dl><article class="inbox-letter-content" aria-label="알림 내용">'+E(x.content)+'</article></div><footer class="modal-footer"><button class="btn" data-close>닫기</button></footer></section>';
  document.body.append(detail);detail.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDetail);const u=linkFor(x);
  if(u){const labels={report:'수업 레포트 보기',task:'업무 확인하기',transfer:'학생 이동 확인하기',staff_chat:'메신저 열기',attendance:'출결 확인하기',homework:'과제 확인하기',consultation:'상담 확인하기',reminder:'출결 확인하기'};let jump;
   if(['task','transfer','staff_chat'].includes(x.kind)||x.kind.startsWith('withdrawal_')){jump=document.createElement('button');jump.type='button';jump.onclick=()=>{close();x.kind.startsWith('withdrawal_')?MiraeCounsel.openURL(u.href):x.kind==='staff_chat'?MiraeMessenger.openURL(u.href):MiraeWorkflow.openURL(u.href)}}
   else{jump=document.createElement('a');jump.href=u.href}
   jump.className='btn primary';jump.dataset.inboxRelated='';jump.textContent=labels[x.kind]||'관련 화면으로 이동';detail.querySelector('footer').append(jump);
  }
  detail.querySelector('[data-close]').focus();
 }catch(e){if(box.isConnected)box.querySelector('[data-inbox-status]').textContent=e.message}finally{reading=false}}
 async function load(){const stamp=++request;try{await P.ensureSession();const r=await P.rpc('inbox',{offset,limit:30});if(!box.isConnected||stamp!==request)return;total=r.total;
  box.querySelector('[data-inbox-status]').innerHTML='<span class="summary-chip"><span>전체</span><strong>'+total+'</strong></span><span class="summary-chip unread"><span>안 읽음</span><strong>'+r.unread+'</strong></span>';
  box.querySelector('[data-page]').textContent=Math.floor(offset/30)+1+' / '+Math.max(1,Math.ceil(total/30));box.querySelector('[data-prev]').disabled=offset===0;box.querySelector('[data-next]').disabled=offset+30>=total;
  box.querySelector('[data-inbox-list]').innerHTML=(r.rows.length?'<div class="inbox-list-head" aria-hidden="true"><span>발신자</span><span>보낸 시각</span><span>내용</span></div>':'')+r.rows.map(x=>'<article class="inbox-row '+(!x.read_at?'unread':'')+'"><button type="button" data-inbox-message="'+E(x.id)+'" aria-label="'+E((x.sender_name||'미래탐구')+' · '+x.title)+'"><span class="inbox-list-sender">'+E(x.sender_name||'미래탐구')+'</span><time class="inbox-list-time" datetime="'+E(x.created_at)+'">'+E(new Date(x.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}))+'</time><span class="inbox-list-content"><strong>'+E(x.title)+'</strong><span>'+E(String(x.content||'').replace(/\s+/g,' ').trim())+'</span></span></button></article>').join('')||'<p class="board-empty">받은 알림이 없습니다.</p>';
  box.querySelectorAll('[data-inbox-message]').forEach(b=>b.onclick=()=>readMessage(r.rows.find(x=>x.id===b.dataset.inboxMessage)));
 }catch(e){if(box.isConnected&&stamp===request)box.querySelector('[data-inbox-status]').textContent='알림함을 불러오지 못했습니다. '+e.message}}
 await load();
}
window.MiraeInbox={VERSION:'261010_7',refresh,open};setInterval(()=>{if(document.visibilityState==='visible'&&document.querySelector('[data-inbox-count]'))refresh()},60000);
})();
