(()=>{'use strict';
const form=document.querySelector('#setup'),result=document.querySelector('#result');let store=null,checked='';
form.elements.url.value=window.MIRAE_CONFIG?.SUPABASE_URL||'';form.elements.key.value=window.MIRAE_CONFIG?.SUPABASE_KEY||'';
function config(){const u=new URL(form.elements.url.value.trim());if(u.protocol!=='https:'||u.pathname!=='/')throw Error('Supabase 프로젝트 기본 URL을 입력하세요.');const key=form.elements.key.value.trim();if(!key||key.startsWith('sb_secret_'))throw Error('Publishable 또는 anon 키를 입력하세요.');return{VERSION:'261010_9',BRAND:'미래탐구',SUPABASE_URL:u.origin,SUPABASE_KEY:key}}
function remember(c){try{localStorage.setItem('mirae-v2-connection',JSON.stringify(c))}catch{}}
form.onsubmit=async e=>{e.preventDefault();try{const c=config();store=new window.MiraeStore.Store(c);const info=await store.publicInfo();if(!Number.isInteger(info.security_version)||info.security_version<38)throw Error('SQL 38을 먼저 적용해 주세요.');checked=JSON.stringify(c);remember(c);result.textContent='연결 확인 완료. config.js를 내려받아 올린 뒤 기존 계정으로 로그인하세요. 첫 관리자 생성은 Supabase SQL Editor에서만 가능합니다.'}catch(err){result.textContent=err.message;}};
document.querySelector('#download').onclick=()=>{try{const c=config();if(checked!==JSON.stringify(c))throw Error('먼저 연결 확인 버튼을 눌러 주세요.');const url=URL.createObjectURL(new Blob(['window.MIRAE_CONFIG = '+JSON.stringify(c,null,2)+';\n'],{type:'text/javascript;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='config.js';a.click();remember(c);setTimeout(()=>URL.revokeObjectURL(url),3000);result.textContent='config.js를 내려받았습니다. web 폴더의 기존 config.js를 이 파일로 교체해 주세요.'}catch(e){result.textContent=e.message}};
window.addEventListener('mirae-log',()=>{document.querySelector('#setup-log').value=window.MiraeStore.logs()});
})();
