/* Separate MSwitch state: no password persistence in browser storage. */
(() => {
  'use strict';
  const RELINK='엠스위치와의 자동 연동이 해지된 상태입니다. 다시 연동해주세요';
  let config=null, generation=0, linkVersion=0, status=null, logs=[], chosen=new Map(), results=[], page=1, keyword='', draft='', mode='info', channels='har', sender='', busy=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uuid=()=>crypto.randomUUID();
  const key=()=>`mirae-mswitch-pending:${config.user().id}`;
  const pending=()=>{try{return JSON.parse(sessionStorage.getItem(key())||'null')}catch{return null}};
  function remember(value){try{if(value)sessionStorage.setItem(key(),JSON.stringify(value));else sessionStorage.removeItem(key())}catch{throw Error('발송 기록을 브라우저에 보관할 수 없습니다. 저장소 사용을 허용해 주세요.')}}
  function append(items){logs.push(...items);if(logs.length>700)logs=logs.slice(-700);document.querySelectorAll('.msw-logs').forEach(t=>{t.value=logs.map(x=>JSON.stringify(x)).join('\n');t.scrollTop=t.scrollHeight})}
  function local(event,data={}){append([{time:new Date().toISOString(),version:'1.7.0',event,...data}])}
  function logBox(){return `<details class="msw-logbox" open><summary>결과 및 로그</summary><p>오류가 나면 아래 내용을 복사해서 전달해 주세요. 비밀번호·세션 쿠키는 제외되며 학생명·전화번호·문자내용이 포함될 수 있습니다.</p><div class="msw-row"><button type="button" data-msw="copy">로그 복사</button><button type="button" data-msw="download">TXT 저장</button><button type="button" data-msw="clear">로그 비우기</button></div><textarea class="msw-logs" readonly spellcheck="false" aria-label="엠스위치 결과 및 로그">${esc(logs.map(x=>JSON.stringify(x)).join('\n'))}</textarea></details>`}
  function bindLogs(root){
    root.querySelector('[data-msw="copy"]').onclick=async()=>{const t=root.querySelector('.msw-logs');try{await navigator.clipboard.writeText(t.value);config.toast('로그를 복사했습니다.')}catch{t.focus();t.select();config.toast('선택된 로그를 Ctrl+C로 복사해 주세요.')}};
    root.querySelector('[data-msw="download"]').onclick=()=>{const url=URL.createObjectURL(new Blob([root.querySelector('.msw-logs').value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='mswitch-'+new Date().toISOString().replace(/[:.]/g,'-')+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
    root.querySelector('[data-msw="clear"]').onclick=()=>{logs=[];append([])};
  }
  async function call(path,body){
    const token=config.token(),epoch=generation;
    if(config.demo)return demo(path,body);
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),150000);
    local('browser.request',{path});
    try{
      const response=await fetch(String(config.url||'').replace(/\/$/,'')+'/api/mswitch/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:ctrl.signal});
      if(epoch!==generation||token!==config.token())throw Error('계정이 변경되어 이전 요청 결과를 표시하지 않았습니다.');
      let d;try{d=await response.json()}catch{throw Error('서버 응답이 JSON이 아닙니다. Cloud Run 주소와 서버 배포 버전을 확인해 주세요.')}
      append(d.logs||[]);
      local('browser.response',{path,http_status:response.status,ok:d.ok,state:d.state,message:d.message,request_id:d.request_id||d.send_id});
      if(!response.ok)throw Error(typeof d.detail==='string'?d.detail:`서버 오류 HTTP ${response.status}`);
      return d;
    }catch(e){if(epoch===generation)local('browser.error',{path,kind:e.name,message:e.name==='AbortError'?'응답 시간 초과':e.message});throw e}
    finally{clearTimeout(timer)}
  }
  function needsLink(d){if(d.needs_link){status={...status,linked:false};config.openLink(RELINK);return true}return false}
  async function auto(){
    if(!config||!['admin','teacher'].includes(config.user()?.role))return;
    const epoch=generation,version=linkVersion;
    try{const d=await call('auto',{});if(epoch!==generation||version!==linkVersion)return;status=d;if(d.ok)config.changed?.();if(!needsLink(d)&&!d.ok)config.toast(d.message,true)}
    catch(e){if(epoch===generation&&version===linkVersion){local('auto.unavailable',{message:e.message});config.openLink(RELINK+'\n'+e.message)}}
  }
  function options(){return (status?.replies||[]).map(r=>`<option value="${esc(r.phone)}" ${r.phone===sender?'selected':''}>${esc(r.phone)}${r.default?' · 대표':''}</option>`).join('')}
  function notice(root,message,error=false){const box=root.querySelector('.msw-result');if(box){box.textContent=message;box.classList.toggle('msw-error',error)}}
  async function mountLink(root,message=''){
    const epoch=generation;
    root.className='msw';
    root.innerHTML=`<p>현재 클래스룸 계정에 본인의 엠스위치 계정을 연결합니다. 다음 로그인부터 자동으로 연동합니다.</p><div class="msw-result" role="status">${esc(message||'연동 상태를 확인하고 있습니다.')}</div><form class="msw-link-form"><label>엠스위치 아이디<input name="username" autocomplete="off" maxlength="150" required></label><label>엠스위치 비밀번호<input name="password" type="password" autocomplete="new-password" maxlength="256" required placeholder="저장된 비밀번호는 표시하지 않습니다"></label><div class="msw-row"><button type="submit" class="msw-primary">연동하기</button><button type="button" data-msw="unlink">저장된 연동 삭제</button></div></form><p class="msw-note">계정 정보는 본인 계정에 저장합니다. 요청에 따라 DB에는 평문으로 보관하며 DB 관리자에게는 비밀번호가 보입니다.</p>${logBox()}`;
    bindLogs(root);const form=root.querySelector('form');
    form.onsubmit=async e=>{e.preventDefault();const version=++linkVersion;const button=form.querySelector('[type="submit"]');button.disabled=true;notice(root,'엠스위치에 로그인하고 사용자 이름을 확인하고 있습니다.');
      try{const d=await call('link',{username:form.elements.username.value,password:form.elements.password.value});form.elements.password.value='';if(epoch!==generation||version!==linkVersion)return;if(d.ok){status=d;chosen.clear();results=[];sender='';config.changed?.();}notice(root,d.message,!d.ok)}catch(err){form.elements.password.value='';notice(root,err.message,true)}finally{button.disabled=false}};
    root.querySelector('[data-msw="unlink"]').onclick=async()=>{if(!confirm('본인의 저장된 엠스위치 계정을 삭제할까요?'))return;++linkVersion;try{const d=await call('unlink',{});if(epoch!==generation)return;status=d;chosen.clear();results=[];config.changed?.();form.reset();notice(root,d.message)}catch(e){notice(root,e.message,true)}};
    const version=linkVersion;
    try{const d=await call('status');if(epoch!==generation||!root.isConnected||version!==linkVersion)return;status=d;form.elements.username.value=d.username||'';if(!message)notice(root,d.linked?`${d.name}님 · 연동되어 있습니다.`:d.needs_link?RELINK:'아직 연동된 엠스위치 계정이 없습니다.')}catch(e){if(root.isConnected)notice(root,e.message,true)}
  }
  function paintPeople(root){
    const list=root.querySelector('.msw-search-list');
    list.innerHTML=results.length?results.map((x,i)=>`<label class="msw-person"><input type="checkbox" data-pick="${i}" ${chosen.has(x.key)?'checked':''}><span><strong>${esc(x.name)}</strong><small>학부모${x.parent===2?' 2':''} · ${esc(x.phone)}</small></span></label>`).join(''):'<p class="msw-note">학생명을 입력하여 엠스위치에서 검색해 주세요. 이 사이트에 학생을 등록하지 않아도 됩니다.</p>';
    list.querySelectorAll('[data-pick]').forEach(el=>el.onchange=()=>{const p=results[+el.dataset.pick];if(el.checked)chosen.set(p.key,p);else chosen.delete(p.key);paintSelected(root)});
    paintSelected(root);
  }
  function paintSelected(root){
    const people=[...chosen.values()];const count=people.length,duplicates=count-new Set(people.map(p=>p.phone.replace(/\D/g,''))).size;
    root.querySelector('.msw-count').textContent=`학부모 ${count}명 · 학생 0명${duplicates?' · 동일 번호 중복 선택':''}`;
    root.querySelector('.msw-selected').innerHTML=people.map((p,i)=>`<button type="button" data-remove="${i}">${esc(p.name)} · ${esc(p.phone)} ×</button>`).join('');
    root.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{chosen.delete(people[+b.dataset.remove].key);paintPeople(root)});
    root.querySelector('[data-msw="send"]').disabled=busy||Boolean(pending())||!status?.linked||!count;
  }
  async function mountSend(root){
    const epoch=generation;
    root.className='msw';
    root.innerHTML=`<div class="msw-heading"><div><h1>문자보내기</h1><p>엠스위치에서 학생을 검색하고 학부모에게 보냅니다.</p></div><button type="button" data-msw="link">엠스위치 연동</button></div><div class="msw-result" role="status">연동 상태 확인 중</div><div class="msw-columns"><section class="msw-card"><h2>1. 받는 사람</h2><form class="msw-search msw-row"><input name="keyword" aria-label="학생명" placeholder="학생명 입력" value="${esc(keyword)}" required maxlength="50"><button type="submit">검색</button></form><div class="msw-search-list"></div><div class="msw-row"><button type="button" data-msw="prev">이전 검색 페이지</button><span class="msw-page">${page} 페이지</span><button type="button" data-msw="next">다음 검색 페이지</button></div><h3 class="msw-count"></h3><div class="msw-selected"></div></section><section class="msw-card"><h2>2. 문자내용</h2><label>문자 구분<select name="mode"><option value="info">정보성</option><option value="ad">광고성 · (광고) 자동 표시</option></select></label><label>발신번호<select name="sender" aria-label="발신번호">${options()}</select></label><label>발송 경로<select name="channels"><option value="har">기존 엠스위치 설정 · 앱 / 알림톡 / SMS</option><option value="sms">SMS만 요청</option></select></label><p class="msw-note">기본 경로는 제공된 성공 기록과 같습니다. SMS만 요청하는 경로는 실제 발송 테스트가 필요합니다.</p><label>문자내용<textarea name="message" rows="7" maxlength="2000" placeholder="내용을 입력하세요">${esc(draft)}</textarea></label><div class="msw-row"><button type="button" class="msw-primary" data-msw="send">발송</button><button type="button" data-msw="new">발송내역 확인 후 새 요청 시작</button></div><p class="msw-note">접수 성공은 휴대전화 수신 완료를 뜻하지 않습니다. 응답이 끊긴 경우 발송내역을 먼저 확인하세요.</p></section></div>${logBox()}`;
    bindLogs(root);paintPeople(root);
    root.querySelector('[data-msw="link"]').onclick=()=>config.openLink('');
    root.querySelector('[name="mode"]').value=mode;root.querySelector('[name="channels"]').value=channels;
    root.querySelector('[name="mode"]').onchange=e=>{mode=e.target.value};root.querySelector('[name="channels"]').onchange=e=>{channels=e.target.value};
    root.querySelector('[name="message"]').oninput=e=>{draft=e.target.value};root.querySelector('[name="sender"]').onchange=e=>{sender=e.target.value};
    async function find(p){
      const text=root.querySelector('[name="keyword"]').value.trim();if(!text)return;
      const buttons=[...root.querySelectorAll('.msw-search button,[data-msw="prev"],[data-msw="next"]')];buttons.forEach(b=>b.disabled=true);
      try{const d=await call('search',{keyword:text,page:p});if(epoch!==generation)return;if(needsLink(d))return;if(!d.ok)throw Error(d.message);keyword=text;page=p;results=d.students;root.querySelector('.msw-page').textContent=page+' 페이지';paintPeople(root);notice(root,results.length?`${results.length}개의 학부모 연락처를 찾았습니다.`:'이 페이지에 검색 결과가 없습니다. 학생명 또는 이전 페이지를 확인하세요.')}catch(e){notice(root,e.message,true)}finally{buttons.forEach(b=>b.disabled=false)}
    }
    root.querySelector('.msw-search').onsubmit=e=>{e.preventDefault();find(1)};
    root.querySelector('[data-msw="prev"]').onclick=()=>find(Math.max(1,page-1));root.querySelector('[data-msw="next"]').onclick=()=>find(page+1);
    root.querySelector('[data-msw="new"]').onclick=()=>{if(busy)return;if(pending()&&!confirm('엠스위치 발송내역에서 기존 요청 결과를 확인했나요? 새 요청은 별도 발송으로 처리됩니다.'))return;try{remember(null);notice(root,'새 요청을 보낼 수 있습니다. 받는 사람과 내용을 확인하세요.');paintSelected(root)}catch(e){notice(root,e.message,true)}};
    root.querySelector('[data-msw="send"]').onclick=async()=>{
      if(busy||pending())return;if(!draft.trim())return notice(root,'문자내용을 입력하세요.',true);
      const count=chosen.size;
      if(!confirm(`학부모 ${count}명에게 ${mode==='ad'?'광고성':'정보성'} 문자를 발송할까요?`))return;
      let requestId;try{requestId=uuid();remember({request_id:requestId,at:new Date().toISOString(),state:'pending'})}catch(e){notice(root,e.message,true);return}
      busy=true;paintSelected(root);notice(root,'발송을 요청하고 있습니다.');
      try{const d=await call('send',{request_id:requestId,recipients:[...chosen.values()].map(p=>p.selection),message:draft,mode,channels,sender});if(epoch!==generation)return;remember({request_id:requestId,at:new Date().toISOString(),state:d.state||'unknown'});notice(root,d.message,!d.ok);if(d.needs_link)needsLink(d)}catch(e){if(epoch!==generation)return;local('send.unknown',{send_id:requestId});notice(root,'발송 결과 확인 불가: '+e.message+' 이미 접수되었을 수 있으므로 엠스위치 발송내역을 먼저 확인하세요.',true)}finally{if(epoch===generation){busy=false;paintSelected(root)}}
    };
    try{const d=await call('status');if(epoch!==generation||!root.isConnected)return;status=d;if(!sender)sender=(d.replies?.find(x=>x.default)||d.replies?.[0])?.phone||'';root.querySelector('[name="sender"]').innerHTML=options();notice(root,pending()?'이 브라우저에 이전 발송 요청이 남아 있습니다. 발송내역 확인 후 새 요청을 시작하세요.':d.linked?`${d.name}님 계정으로 발송합니다.`:'먼저 엠스위치 계정을 연동해 주세요.');paintSelected(root);if(d.needs_link)needsLink(d)}catch(e){notice(root,e.message,true)}
  }
  function reset(){++generation;++linkVersion;status=null;logs=[];chosen.clear();results=[];page=1;keyword='';draft='';mode='info';channels='har';sender='';busy=false}
  function demo(path,body){
    local('preview',{path,message:'미리보기 · 실제 엠스위치에 접속하지 않습니다.'});
    if(path==='link'){status={ok:true,linked:true,username:body.username,name:'미리보기 강사',replies:[{phone:'0200000000',default:true}]};return Promise.resolve({...status,message:'미리보기 연동 완료 · 실제 저장하지 않았습니다.'})}
    if(path==='unlink'){status=null;return Promise.resolve({ok:true,linked:false,message:'미리보기 연동 삭제'})}
    if(path==='status'||path==='auto')return Promise.resolve(status||{ok:true,linked:false,username:'',replies:[]});
    if(path==='search')return Promise.resolve({ok:true,students:[1,2].map(i=>({key:'demo'+i,name:body.keyword+(i===2?' (동명이인)':''),phone:'010-0000-000'+i,parent:1,selection:'demo'+i}))});
    return Promise.resolve({ok:true,state:'accepted',message:'미리보기 접수 완료 · 실제 문자는 발송되지 않았습니다.'});
  }
  window.MiraeSMS={configure:c=>{config=c},auto,mountLink,mountSend,reset};
})();
