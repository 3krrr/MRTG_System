/* Short-lived, session-scoped read cache. Writes always reach the authoritative RPC. */
(()=>{'use strict';const db=MiraeStore,raw=db.rpc.bind(db),auth=db.setAuth.bind(db),entries=new Map(),pending=new Map(),listeners=new Set();let epoch=0,cfg={},warmOwner='',warmTimer;
const safe={mirae_portal_bridge:new Set(['activity','activity_detail','communications_summary','communications_detail']),mirae_workflow:new Set(['recent-logins','directory']),mirae_registration_support:new Set(['book-read'])};
const clone=x=>JSON.parse(JSON.stringify(x)),key=(name,body)=>JSON.stringify([epoch,name,body]);
function reset(){epoch++;entries.clear();pending.clear();listeners.clear();warmOwner='';clearTimeout(warmTimer)}
function invalidate(){epoch++;entries.clear();pending.clear()}
function emit(name){for(const item of listeners){if(!item.node.isConnected){listeners.delete(item);continue}if(item.names.includes(name))item.update()}}
db.setAuth=a=>{reset();return auth(a)};
db.rpc=async(name,body={},options={})=>{
 const cacheable=safe[name]?.has(body.p_action),k=key(name,body),g=epoch;
 if(!cacheable){const result=await raw(name,body,options);if(name==='mirae_secure_commit'||['mirae_family_accounts','mirae_registration_support','mirae_workflow','mirae_withdrawal'].includes(name)&&!['identity_index','list','match-phones','health','print-books','tasks','groups','transfers','makeup-overview','context','parent_context','parent_search','transfer-notifications','task-notifications','schedule','roster','dashboard'].includes(body.p_action))invalidate();return result}
 const old=entries.get(k);
 const refresh=()=>{if(pending.has(k))return pending.get(k);const task=raw(name,body,options).then(r=>{if(g===epoch){entries.set(k,{value:clone(r),time:Date.now()});while(entries.size>80)entries.delete(entries.keys().next().value);if(old)queueMicrotask(()=>emit(name))}return r}).finally(()=>{if(pending.get(k)===task)pending.delete(k)});pending.set(k,task);return task};
 if(!options.fresh&&old&&Date.now()-old.time<120000){if(Date.now()-old.time>15000)void refresh().catch(()=>{});return clone(old.value)}
 return clone(await refresh());
};
async function warm(view='all'){
 const u=cfg.user?.();if(!u||!['admin','teacher'].includes(u.role)||document.hidden)return;
 const session=(await MiraePush.ensureSession()).session,day=MiraeAttendanceCore.korea().date,d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-29);const dates={start:d.toISOString().slice(0,10),end:day},jobs=[];
 const add=(name,action,data)=>jobs.push(db.rpc(name,{p_session:session,p_action:action,p_data:data}).catch(()=>{}));
 if((view==='all'||view==='login_history')&&(cfg.can?.('login_history_own')||cfg.can?.('login_history_all'))){add('mirae_portal_bridge','activity',dates);add('mirae_workflow','recent-logins',dates)}
 if((view==='all'||view==='communications')&&cfg.can?.('communications'))add('mirae_portal_bridge','communications_summary',{...dates,query:'',channel:'',offset:0,limit:50,sort:'sent_at',direction:'desc'});
 if((view==='all'||view==='attendance_book'||view==='attendance')&&cfg.can?.('attendance')){const base=cfg.base?.(),c=MiraeAttendanceCore.pickClass(base?.classes||[],u,day,MiraeAttendanceCore.korea().time)||base?.classes?.find(c=>c.status==='active');if(c)add('mirae_registration_support','book-read',{class_id:c.id,month:day.slice(0,7)})}
 await Promise.allSettled(jobs);
}
document.addEventListener('pointerover',e=>{const v=e.target.closest('[data-view]')?.dataset.view;if(['login_history','communications','attendance_book','attendance'].includes(v))void warm(v).catch(()=>{})},{passive:true});
window.MiraeFastReads={configure(c){cfg=c},reset,invalidate,warm,subscribe(node,names,update){listeners.add({node,names,update})},start(){const id=cfg.user?.()?.id;if(!id||id===warmOwner)return;warmOwner=id;clearTimeout(warmTimer);warmTimer=setTimeout(()=>{if(cfg.user?.()?.id===id)void warm().catch(()=>{})},600)}};
})();
