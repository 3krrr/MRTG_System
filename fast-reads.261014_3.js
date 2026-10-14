/* Short-lived, session-scoped read cache. Writes always reach the authoritative RPC. */
(()=>{'use strict';const db=MiraeStore,raw=db.rpc.bind(db),auth=db.setAuth.bind(db),entries=new Map(),pending=new Map(),listeners=new Set();let epoch=0,cfg={},warmOwner='',warmTimer;
const safe={mirae_portal_bridge:new Set(['activity','activity_detail','communications_summary','communications_detail','inbox']),mirae_workflow:new Set(['recent-logins','directory','transfers','tasks','groups']),mirae_push_bridge:new Set(['list']),mirae_registration_support:new Set(['book-read'])};
const clone=x=>JSON.parse(JSON.stringify(x)),key=(name,body)=>JSON.stringify([epoch,name,body]);
function reset(){window.MiraeStudentAccounts?.clear();epoch++;entries.clear();pending.clear();listeners.clear();warmOwner='';clearTimeout(warmTimer)}
function invalidate(){window.MiraeStudentAccounts?.clear();epoch++;entries.clear();pending.clear()}
function emit(name){for(const item of listeners){if(!item.node.isConnected){listeners.delete(item);continue}if(item.names.includes(name))item.update()}}
db.setAuth=a=>{reset();return auth(a)};
db.rpc=async(name,body={},options={})=>{
 const cacheable=safe[name]?.has(body.p_action),k=key(name,body),g=epoch;
 if(!cacheable){const result=await raw(name,body,options);if(name==='mirae_enrollment'&&body.p_action==='save'||name==='mirae_secure_commit'||name==='mirae_management_bridge'||name==='mirae_portal_bridge'&&body.p_action==='inbox_read'||['mirae_family_accounts','mirae_registration_support','mirae_workflow','mirae_withdrawal','mirae_push_bridge','mirae_school_grades','mirae_counsel_import'].includes(name)&&!['self','device','list','identity_index','match-phones','health','print-books','tasks','groups','transfers','makeup-overview','context','parent_context','parent_search','transfer-notifications','task-notifications','schedule','roster','dashboard','get','read','history','overview','config_get','status'].includes(body.p_action))invalidate();return result}
 const old=entries.get(k);
 const refresh=()=>{if(pending.has(k))return pending.get(k);const task=raw(name,body,options).then(r=>{if(g===epoch){entries.set(k,{value:clone(r),time:Date.now()});while(entries.size>80)entries.delete(entries.keys().next().value);if(old)queueMicrotask(()=>emit(name))}return r}).finally(()=>{if(pending.get(k)===task)pending.delete(k)});pending.set(k,task);return task};
 if(!options.fresh&&old&&Date.now()-old.time<120000){if(Date.now()-old.time>15000)void refresh().catch(()=>{});return clone(old.value)}
 return clone(await refresh());
};
async function warm(view='all'){
 const u=cfg.user?.();if(!u||document.hidden)return;
 const session=(await MiraePush.ensureSession()).session,day=MiraeAttendanceCore.korea().date,d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-29);const dates={start:d.toISOString().slice(0,10),end:day},jobs=[];
 const add=(name,action,data={})=>jobs.push(db.rpc(name,{p_session:session,p_action:action,p_data:data}).catch(()=>{}));
 if(view==='all')jobs.push(MiraeInbox.refresh().catch(()=>{}));
 if(!['admin','teacher'].includes(u.role)){await Promise.allSettled(jobs);return}
 if(view==='all'&&cfg.can?.('students'))jobs.push(MiraeStudentAccounts.prefetch().catch(()=>{}));
 if(view==='all'||view==='transfers'){if(cfg.can?.('student_transfer')||cfg.can?.('class_edit')){add('mirae_workflow','directory');add('mirae_workflow','transfers')}}
 if(view==='all'||view==='tasks'){if(cfg.can?.('task_share')){add('mirae_workflow','tasks');add('mirae_workflow','groups');add('mirae_workflow','directory')}}
 if(view==='all'||view==='push'||view==='push_status')jobs.push(MiraePush.refreshList().catch(()=>{}));
 if((view==='all'||view==='login_history')&&(cfg.can?.('login_history_own')||cfg.can?.('login_history_all'))){add('mirae_portal_bridge','activity',dates);add('mirae_workflow','recent-logins',dates)}
 if((view==='all'||view==='communications')&&cfg.can?.('communications'))add('mirae_portal_bridge','communications_summary',{...dates,query:'',channel:'',offset:0,limit:50,sort:'sent_at',direction:'desc'});
 if((view==='all'||view==='attendance_book'||view==='attendance')&&cfg.can?.('attendance')){const base=cfg.base?.(),c=MiraeAttendanceCore.pickClass(base?.classes||[],u,day,MiraeAttendanceCore.korea().time)||base?.classes?.find(c=>c.status==='active');if(c)add('mirae_registration_support','book-read',{class_id:c.id,month:day.slice(0,7)})}
 await Promise.allSettled(jobs);
}
document.addEventListener('pointerover',e=>{const v=e.target.closest('[data-view]')?.dataset.view;if(['login_history','communications','attendance_book','attendance','transfers','tasks','push','push_status'].includes(v))void warm(v).catch(()=>{})},{passive:true});
let lastWake=0;const wake=()=>{if(!document.hidden&&cfg.user?.()&&Date.now()-lastWake>15000){lastWake=Date.now();void warm().catch(()=>{})}};window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
window.MiraeFastReads={configure(c){cfg=c},reset,invalidate,warm,subscribe(node,names,update){listeners.add({node,names,update})},start(){const id=cfg.user?.()?.id;if(!id||id===warmOwner)return;warmOwner=id;clearTimeout(warmTimer);warmTimer=setTimeout(()=>{if(cfg.user?.()?.id===id)void warm().catch(()=>{})},0)}};
})();
