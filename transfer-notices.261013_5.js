(()=>{'use strict';
let owner='',generation=0,count=0,poll=null,pending=null;
const employee=u=>['admin','teacher'].includes(u?.role);
function paint(){for(const b of document.querySelectorAll('.sidebar [data-view="transfers"],.sidebar [data-group="students"]')){let n=b.querySelector('[data-transfer-count]');if(!n){n=document.createElement('b');n.className='count transfer-count';n.dataset.transferCount='';b.append(n)}n.hidden=!count;n.textContent=count>99?'99+':String(count);n.setAttribute('aria-label','학생 이동 확인 필요 '+count+'건')}}
async function refresh(){if(!owner||pending)return pending;const id=owner,g=generation;pending=(async()=>{try{const auth=await MiraePush.ensureSession(),r=await MiraeStore.rpc('mirae_workflow',{p_session:auth.session,p_action:'transfer-notifications',p_data:{}});if(id===owner&&g===generation){count=r.total||0;paint()}}catch{}finally{if(g===generation)pending=null}})();return pending}
function syncUser(u){const next=employee(u)?u.id:'';if(next!==owner){owner=next;generation++;count=0;pending=null;clearInterval(poll);if(owner){refresh();poll=setInterval(()=>{if(!document.hidden)refresh()},15000)}}paint();requestAnimationFrame(paint)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
addEventListener('mirae-transfer-changed',refresh);addEventListener('mirae-session-ready',refresh);
window.MiraeTransferNotice={count:()=>count,syncUser,refresh,paint};
})();
