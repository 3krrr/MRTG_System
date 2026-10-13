(function(root){'use strict';
const OPTIONS=[['all','전체'],['math','수학'],['science','과학'],['gifted','영재'],['science_high','과고']];
function normalize(value){return ({수학:'math',과학:'science',영재:'gifted',과고:'science_high',과학고:'science_high',전체:'all',math:'math',science:'science',gifted:'gifted',science_high:'science_high',all:'all'})[value]||'all'}
function scope(a){return a?.role==='admin'||['parent','student'].includes(a?.role)?'all':normalize(a?.subject_scope)}
function scopes(a){const first=scope(a);return first==='all'?['all']:[...new Set([first,...(a?.subject_scope2&&normalize(a.subject_scope2)!=='all'?[normalize(a.subject_scope2)]:[])])]}
function allows(a,s){return scopes(a).includes('all')||scopes(a).includes(s)}
function overlaps(a,t){return scopes(a).includes('all')||scopes(t).includes('all')||scopes(t).some(s=>allows(a,s))}
function contains(a,t){return scopes(a).includes('all')||scopes(t).every(s=>scopes(a).includes(s))}
function label(a){return scopes(a).map(s=>OPTIONS.find(x=>x[0]===s)[1]).join(' · ')}
function subject(D,c){const text=String(c?.subject||'').trim();if(/영재|gifted/i.test(text))return'gifted';if(/과고|과학고|science_high/i.test(text))return'science_high';if(/수학|math/i.test(text))return'math';if(/과학|물리|화학|생명|생물|지구|science/i.test(text))return'science';const teacher=D.accounts.find(a=>a.id===c?.teacher_id);return teacher?.subject_scope?normalize(teacher.subject_scope):'all'}
function classAllowed(D,a,c){return !!c&&allows(a,subject(D,c))}
function staffAllowed(D,a,t){if(!t)return false;if(scope(a)==='all')return true;if(t.role==='admin'||scope(t)==='all')return D.classes.some(c=>MiraeTeam.has(c,t.id)&&classAllowed(D,a,c));return overlaps(a,t)}
function assertClass(D,a,id){const c=D.classes.find(c=>c.id===id);if(!classAllowed(D,a,c))throw Error('지정된 과목의 수업만 열 수 있습니다.');return c}
function scoped(D,a){if(scope(a)==='all')return D;const classes=D.classes.filter(c=>classAllowed(D,a,c)),ids=new Set(classes.map(c=>c.id)),enrollments=D.enrollments.filter(e=>ids.has(e.class_id)),sids=new Set(enrollments.map(e=>e.student_id));for(const r of D.attendance||[])if(ids.has(r.class_id))sids.add(r.student_id);const students=D.students.filter(s=>sids.has(s.id)),pids=new Set(students.map(s=>s.parent_id));return{...D,classes,enrollments,students,parents:D.parents.filter(p=>pids.has(p.id)),accounts:D.accounts.filter(t=>staffAllowed(D,a,t))}}
const api={OPTIONS,normalize,scope,scopes,allows,overlaps,contains,label,subject,classAllowed,staffAllowed,assertClass,scoped};root.MiraeSubject=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
