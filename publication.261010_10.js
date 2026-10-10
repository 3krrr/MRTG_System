(function(root){'use strict';
const OPTIONS=[['all','모두'],['student','학생에게만'],['parent','학부모에게만'],['private','비공개']];
const FIELDS=[['progress','진도'],['homework','숙제 안내 · 과제 검사'],['video','영상'],['materials','추가 자료'],['notice','공지'],['feedback','학생 코멘트'],['exams','테스트 · 성적'],['syllabus','강의계획']];
const family=a=>['parent','student'].includes(a?.role),scope=(c,l,k)=>l?.visibility?.[k]||c?.visibility?.[k]||'all';
function allows(a,c,l,k){if(!family(a))return true;if(l?.published===false)return false;const s=scope(c,l,k);return s==='all'||s===a.role}
function valid(v,inherit=false){if(v==null)return{};if(!v||typeof v!=='object'||Array.isArray(v))throw Error('공개 범위를 확인하세요.');const out={};for(const[k,x]of Object.entries(v)){if(!FIELDS.some(f=>f[0]===k)||!OPTIONS.some(o=>o[0]===x))throw Error('공개 범위를 확인하세요.');out[k]=x}return out}
function form(value={},inherit=false){return '<div class="publication-grid">'+FIELDS.filter(([k])=>!inherit||k!=='syllabus').map(([k,label])=>'<label>'+label+'<select class="input" data-publication="'+k+'">'+(inherit?'<option value="">강좌 설정 따름</option>':'')+OPTIONS.map(([v,n])=>'<option value="'+v+'" '+((value[k]||(!inherit?'all':''))===v?'selected':'')+'>'+n+'</option>').join('')+'</select></label>').join('')+'</div>'}
function collect(node){const v={};node.querySelectorAll('[data-publication]').forEach(x=>{if(x.value)v[x.dataset.publication]=x.value});return valid(v)}
function lesson(a,c,l,sid){if(!family(a))return l;const x={...l};for(const[k,fields]of Object.entries({progress:['progress'],homework:['homework','homework_enabled','online_required','due_at'],video:['video_links'],materials:['material_links'],notice:['notice']})){if(!allows(a,c,l,k))for(const f of fields)x[f]=f.endsWith('_links')?[]:f.endsWith('_enabled')||f==='online_required'?false:f==='due_at'?null:''}
 if(Array.isArray(l.video_student_ids)&&!l.video_student_ids.includes(sid))x.video_links=[];
 x.hidden_fields=FIELDS.filter(([k])=>!allows(a,c,l,k)).map(([k])=>k);return x}
const api={OPTIONS,FIELDS,family,scope,allows,valid,form,collect,lesson};root.MiraePublication=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
