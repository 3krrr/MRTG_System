(function(root){'use strict';
const STATUS={present:'출석',late:'지각',absent:'결석',face_makeup:'대면보강',video_makeup:'영상보강',transfer_out:'전출',transfer_in:'전입',campus_transfer:'전관',withdrawn:'퇴원'};
const TERMINAL=['transfer_out','transfer_in','campus_transfer','withdrawn'];
const copy=x=>JSON.parse(JSON.stringify(x)),norm=x=>String(x??'').normalize('NFKC').replace(/\s/g,'').toLowerCase(),digits=x=>String(x??'').replace(/\D/g,''),mins=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
function korea(now=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));return{date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`}}
function validDay(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!isNaN(new Date(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s}
function weekday(date){return new Date(date+'T12:00:00Z').getUTCDay()}
function validateSchedule(c){if(!Array.isArray(c.weekdays)||!c.weekdays.length||c.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('수업 요일을 한 개 이상 선택하세요.');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.start_time||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.end_time||'')||c.start_time>=c.end_time)throw Error('수업 시작·종료 시간을 확인하세요. 종료 시간은 시작 시간보다 늦어야 합니다.');if(!validDay(c.start_date)||!validDay(c.end_date)||c.end_date<c.start_date)throw Error('개강일·종강일을 확인하세요.')}
function pickClass(classes,user,date,time){let own=classes.filter(c=>[c.teacher_id,c.assistant_teacher_id].includes(user.id));if(!own.length&&user.role==='admin')own=classes;return own.filter(c=>c.status==='active'&&c.start_date<=date&&c.end_date>=date&&c.weekdays?.includes(weekday(date))&&c.start_time&&c.end_time&&mins(time)>=mins(c.start_time)-30&&mins(time)<=mins(c.end_time)+30).sort((a,b)=>b.start_time.localeCompare(a.start_time)||a.id.localeCompare(b.id))[0]||null}
function message(className,studentName,arrival){const t=korea(new Date(arrival)).time;return`[미래탐구 출결 알림]\n[${className}] 수업에 ${studentName} 학생이 ${t.slice(0,2)}시 ${t.slice(3)}분에 등원 확인되었습니다.`}
function recordID(classID,date,studentID){return classID+'.'+date.replaceAll('-','')+'.'+studentID}
function sourceStudent(D,s,user){const rows=(D.roster||[]).filter(r=>r.student_no===s.student_no);const parents=[...(s.parent_phones||[]),...rows.flatMap(r=>r.parent_phones||[]),D.parents?.find(p=>p.id===s.parent_id)?.phone||''].map(digits).filter(p=>p.length>=9);return{...s,parent_phones:[...new Set(parents)],student_phone:s.student_phone||rows.find(r=>r.student_phone)?.student_phone||'',source_fields:[...new Set([...(s.source_fields||[]),...rows.flatMap(r=>r.source_fields||[])])],source_contact_fields:Object.assign({},s.source_contact_fields||{},...rows.map(r=>r.source_contact_fields||{}))}}
const targetCache=new WeakMap();
function targets(roster){
 if(!roster)return[];const cached=targetCache.get(roster);if(cached)return cached;
 const groups=new Map();for(const r of roster.rows||[]){const k=String(r.raw?.CENTER_SEQ)+':'+String(r.raw?.CMEM_SEQ);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 const list=(roster.students||[]).map(x=>{const raw=x.raw||{},rows=groups.get(String(raw.CENTER_SEQ)+':'+String(raw.CMEM_SEQ))||[];return{key:String(raw.CMEM_SEQ),center:String(raw.CENTER_SEQ),name:x.name||raw.CMEM_NAME||raw.MEM_NAME||'',school:raw.SCHOOL_NAME||'',grade:raw.SCHYEAR_NAME||'',raw,rows,parent_phones:rows.map(r=>digits(r.phone)),student_phone:digits(raw.CMPHONE||raw.ORI_CMPHONE)}});targetCache.set(roster,list);return list;
}
function matchStudent(student,roster,link,account){
 const all=targets(roster),names=all.filter(x=>norm(x.name)===norm(student.name)),phoneSet=new Set((student.parent_phones||[]).map(digits).filter(p=>p.length>=9));
 const format=t=>({...t,rows:t.rows.filter(r=>r.raw&&['CMEM_SEQ','MEM_SEQ','GRP_FIND_KEY','PRT_ORD'].every(k=>String(r.raw[k]??'')!==''))});
 function found(t,kind){t=format(t);return{kind:t.rows.length?kind:'no_phone',target:t,candidates:[t]}}
 if(link&&link.account_username===account){const t=all.find(x=>x.key===link.cmem_seq&&x.center===link.center&&norm(x.name)===norm(link.confirmed_name));if(t)return found(t,'manual')}
 const strong=names.filter(t=>t.parent_phones.some(p=>phoneSet.has(p))||(student.student_phone&&digits(student.student_phone).length>=9&&digits(student.student_phone)===t.student_phone));
 if(strong.length===1)return found(strong[0],'auto');
 if(strong.length>1)return{kind:'ambiguous',candidates:strong};
 return{kind:names.length===1?'needs_confirmation':names.length?'ambiguous':'missing',candidates:names};
}
function rowStyle(records){const last=[...records].sort((a,b)=>b.date.localeCompare(a.date)||b.updated_at.localeCompare(a.updated_at))[0];return TERMINAL.includes(last?.status)?last.status:''}
function api(D,a,route,body,q,ctx){
 if(!['admin','teacher'].includes(a.role))throw Error('출결은 강사·관리자 메뉴입니다.');
 for(const k of ['attendance','attendanceMessages','studentLinks'])D[k]||=[];
 const now=ctx.now||new Date(),nowISO=now.toISOString(),day=korea(now).date,uid=ctx.uid;
 const classFor=id=>{const c=D.classes.find(c=>c.id===id);if(root.MiraeSubject)root.MiraeSubject.assertClass(D,a,id);if(!c||a.role!=='admin'&&!a.permissions?.includes('all_classes')&&![c.teacher_id,c.assistant_teacher_id].includes(a.id))throw Error('담당 반의 출결만 열 수 있습니다.');return c};
 const studentFor=(c,id,date)=>{const s=D.students.find(s=>s.id===id);if(!s||!D.enrollments.some(e=>e.class_id===c.id&&e.student_id===id&&e.joined_on<=date))throw Error('이 반에 등록된 학생이 아닙니다.');return s};
 const ownMsg=id=>{const m=D.attendanceMessages.find(x=>x.id===id);if(!m||m.owner_id!==a.id)throw Error('본인이 저장한 알림만 처리할 수 있습니다.');classFor(m.class_id);return m};
 if(route.endsWith('/read')){
  const c=classFor(q.get('class_id')),month=q.get('month')||day.slice(0,7);if(!/^\d{4}-\d{2}$/.test(month)||!validDay(month+'-01'))throw Error('조회 월을 확인하세요.');
  const records=D.attendance.filter(r=>r.class_id===c.id&&r.date.startsWith(month));
  const ids=new Set(D.enrollments.filter(e=>e.class_id===c.id).map(e=>e.student_id));records.forEach(r=>ids.add(r.student_id));
  const students=[...ids].map(id=>{const s=D.students.find(s=>s.id===id)||records.find(r=>r.student_id===id)?.student_snapshot;if(!s)return null;return sourceStudent(D,s,a)}).filter(Boolean);
  const row_status=Object.fromEntries(students.map(s=>[s.id,rowStyle(D.attendance.filter(r=>r.class_id===c.id&&r.student_id===s.id&&r.date<=month+'-31'))]));
  return{class:c,students,records,row_status,messages:D.attendanceMessages.filter(m=>m.class_id===c.id&&m.date.startsWith(month)),links:D.studentLinks.filter(l=>l.owner_id===a.id),enrollments:D.enrollments.filter(e=>e.class_id===c.id),day};
 }
 if(!ctx.write)throw Error('저장 요청 방식이 올바르지 않습니다.');
 if(route.endsWith('/save')){
  const c=classFor(body.class_id),live=body.mode==='live';if(!live&&body.mode!=='book')throw Error('출결 저장 방식을 확인하세요.');
  if(!Array.isArray(body.rows)||!body.rows.length||body.rows.length>3000)throw Error('저장할 출결 항목을 확인하세요.');
  const saved=[],seen=new Set();
  for(const input of body.rows){
   const date=input.date||body.date;if(!validDay(date)||live&&date!==day)throw Error('실시간 출결은 오늘 날짜에 저장합니다. 과거 기록은 출석부에서 수정하세요.');
   const s=studentFor(c,input.student_id,date),id=recordID(c.id,date,s.id);if(seen.has(id))throw Error('중복 출결 항목입니다.');seen.add(id);
   if(!(input.status in STATUS))throw Error('출결 상태를 확인하세요.');if(live&&!['present','late','absent'].includes(input.status))throw Error('실시간 출결은 등원·지각·결석만 사용할 수 있습니다.');
   const old=D.attendance.find(r=>r.id===id);if((old?.version||0)!==input.expected_version)throw Error('다른 강사가 출결을 수정했습니다. 다시 불러온 후 저장하세요.');
   let arrival=old?.arrival_at||null;
   if(live&&['present','late'].includes(input.status)&&(!arrival||!['present','late'].includes(old?.status))){arrival=input.arrival_at||nowISO;if(!Number.isFinite(Date.parse(arrival))||korea(new Date(arrival)).date!==day||new Date(arrival)>new Date(now.getTime()+60000))throw Error('등원 확인 시간을 확인하세요.')}
   const next={id,class_id:c.id,student_id:s.id,date,status:input.status,arrival_at:arrival,note:String(input.note??old?.note??'').slice(0,500),version:(old?.version||0)+1,source:body.mode,actor_id:a.id,updated_at:nowISO,student_snapshot:{id:s.id,name:s.name,student_no:s.student_no,school:s.school,grade:s.grade}};
   if(old)Object.assign(old,next);else D.attendance.push(next);saved.push(next);
   const existing=D.attendanceMessages.find(m=>m.id===id);
   if(live&&['present','late'].includes(input.status)&&existing?.state==='cancelled'){Object.assign(existing,{state:'pending',owner_id:a.id,arrival_at:arrival,message:message(c.name,s.name,arrival),updated_at:nowISO})}
   if(live&&['present','late'].includes(input.status)&&!existing)D.attendanceMessages.push({id,class_id:c.id,student_id:s.id,date,owner_id:a.id,state:'pending',arrival_at:arrival,message:message(c.name,s.name,arrival),created_at:nowISO,updated_at:nowISO});
   if(input.status==='absent'&&existing&&['pending','failed'].includes(existing.state)){existing.state='cancelled';existing.updated_at=nowISO}
  }
  return{ok:true,saved,notification_count:D.attendanceMessages.filter(m=>m.class_id===c.id&&m.date===day&&m.owner_id===a.id&&m.state==='pending').length};
 }
 if(route.endsWith('/link')){
  const c=classFor(body.class_id);studentFor(c,body.student_id,day);const account=D.mswitch[a.id]?.username;
  if(!account||body.account_username!==account)throw Error('엠스위치 계정이 바뀌었습니다. 명단을 다시 불러오세요.');
  if(!/^\d+$/.test(String(body.cmem_seq))||!/^\d+$/.test(String(body.center))||!String(body.confirmed_name||'').trim())throw Error('연결할 엠스위치 학생을 확인하세요.');
  const id=a.id+'.'+body.student_id,link={id,owner_id:a.id,student_id:body.student_id,account_username:account,cmem_seq:String(body.cmem_seq),center:String(body.center),confirmed_name:String(body.confirmed_name),updated_at:nowISO};
  const old=D.studentLinks.find(x=>x.id===id);if(old)Object.assign(old,link);else D.studentLinks.push(link);return{ok:true,link};
 }
 if(route.endsWith('/claim')){
  if(!/^[0-9a-f-]{36}$/.test(body.job_id||'')||!Array.isArray(body.items)||!body.items.length||body.items.length>100)throw Error('출결 알림 요청을 확인하세요.');
  const account=D.mswitch[a.id]?.username;if(!account||account!==body.account_username)throw Error('개인 엠스위치 계정을 먼저 연결하세요.');const messages=[];
  for(const item of body.items){const m=ownMsg(item.id),r=D.attendance.find(r=>r.id===m.id);if(m.state==='dispatching'&&m.job_id===body.job_id){messages.push(copy(m));continue}if(m.state!=='pending'||!['present','late'].includes(r?.status))continue;
   if(!Array.isArray(item.selected)||item.selected.length<1||item.selected.length>2||item.selected.some(x=>!x.raw||!['CMEM_SEQ','MEM_SEQ','GRP_FIND_KEY','PRT_ORD','CENTER_SEQ'].every(k=>String(x.raw[k]??'')!=='')))throw Error('매칭된 학부모 식별값이 없습니다.');
   Object.assign(m,{notification_at:nowISO,message:message(classFor(m.class_id).name,D.students.find(s=>s.id===m.student_id).name,nowISO),state:'dispatching',job_id:body.job_id,selected:copy(item.selected),account_username:account,updated_at:nowISO});messages.push(copy(m));
  }
  return{ok:true,messages};
 }
 if(route.endsWith('/report')){
  const list=D.attendanceMessages.filter(m=>m.owner_id===a.id&&m.job_id===body.job_id&&m.state==='dispatching');
  for(const m of list){classFor(m.class_id);const result=(body.results||[]).find(r=>r.notification_id===m.id);let state=result?.state||'unknown';if(!['accepted','failed','unknown','not_sent'].includes(state))state='unknown';if(['failed','not_sent'].includes(state)&&result?.attempted)state='unknown';Object.assign(m,{state:state==='not_sent'?'pending':state,result_code:String(result?.code||''),result_message:String(result?.message||body.message||'결과 확인 필요').slice(0,500),updated_at:nowISO});delete m.selected;if(state==='not_sent')delete m.job_id}
  return{ok:true,count:list.length};
 }
 if(route.endsWith('/retry')){const m=ownMsg(body.id);if(m.state!=='failed')throw Error('접수 결과가 불명확한 알림은 다시 보내지 않습니다. 공식 발송내역을 확인하세요.');m.state='pending';delete m.job_id;return{ok:true}}
 throw Error('지원하지 않는 출결 기능입니다.');
}
const core={STATUS,TERMINAL,korea,validDay,weekday,validateSchedule,pickClass,message,recordID,sourceStudent,targets,matchStudent,rowStyle,api};root.MiraeAttendanceCore=core;if(typeof module!=='undefined')module.exports=core;
})(typeof window!=='undefined'?window:globalThis);
