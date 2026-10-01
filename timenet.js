/* Administrator-managed TimeNet settings. Credential cell values are read by the PC. */
(()=>{'use strict';
const defaults={password_source:'google_sheets',username:'',sheet_id:'',sheet_username_range:'',sheet_password_range:'데이터날짜!A2',sheet_date_range:'데이터날짜!A1',sheet_auth:'api_key',expected_ip:'119.196.240.0/24',centers:['TE21060100','TE07030200'],rbu:'TE23040113',shared_enabled:true,teacher_names:{}};
const text=x=>String(x??'').trim(),copy=x=>JSON.parse(JSON.stringify(x));
function mode(c){return c.password_source||((c.sheet_id||!c.password)?'google_sheets':'direct')}
function sheetID(raw){const v=text(raw);if(/^[A-Za-z0-9_-]{15,150}$/.test(v))return v;try{const u=new URL(v),m=u.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{15,150})(?:\/|$)/);if(u.protocol==='https:'&&u.hostname==='docs.google.com'&&m)return m[1]}catch{}throw Error('스프레드시트 주소 또는 ID를 확인해 주세요.')}
function validateService(sa){if(!sa||sa.type!=='service_account'||!text(sa.client_email)||!text(sa.private_key)||(sa.token_uri&&sa.token_uri!=='https://oauth2.googleapis.com/token'))throw Error('Google 서비스 계정 JSON 파일을 확인해 주세요.');return copy(sa)}
function normalize(input,old={}){
 const c={...copy(defaults),...copy(old)},allowed=['password_source','username','sheet_id','sheet_username_range','sheet_password_range','sheet_date_range','sheet_auth','expected_ip','rbu'];
 for(const k of allowed)if(Object.hasOwn(input,k))c[k]=text(input[k]);
 c.password_source=input.password_source||mode(old);
 if(!['google_sheets','direct'].includes(c.password_source))throw Error('타임넷 연결 방식을 선택하세요.');
 if(!Object.hasOwn(input,'sheet_auth'))c.sheet_auth=old.sheet_auth||(old.service_account?'service_account':'api_key');
 for(const k of ['password','google_api_key'])if(typeof input[k]==='string'&&input[k]!=='')c[k]=k==='password'?input[k]:input[k].trim();
 if(input.service_account)c.service_account=validateService(input.service_account);
 if(Object.hasOwn(input,'shared_enabled')){if(typeof input.shared_enabled!=='boolean')throw Error('강사 공통 사용 여부를 확인하세요.');c.shared_enabled=input.shared_enabled}
 if(Object.hasOwn(input,'teacher_names')){if(!input.teacher_names||typeof input.teacher_names!=='object'||Array.isArray(input.teacher_names))throw Error('타임넷 담임 이름을 확인하세요.');c.teacher_names={};for(const [id,name]of Object.entries(input.teacher_names)){if(!text(name)||text(name).length>100)throw Error('각 강사의 타임넷 담임 이름을 입력하세요.');c.teacher_names[id]=text(name)}}
 if(Object.hasOwn(input,'centers'))c.centers=Array.isArray(input.centers)?input.centers.map(text):text(input.centers).split(',').map(text);
 c.centers=[...new Set(c.centers.filter(Boolean))];if(!c.centers.length||c.centers.length>8||c.centers.some(x=>!/^TE\d{8}$/.test(x)))throw Error('센터 코드를 확인하세요.');
 if(!/^TE\d{8}$/.test(c.rbu))throw Error('사업부 코드를 확인하세요.');
 if(['','119.196.240.*','119.196.240.','119.196.240.23'].includes(c.expected_ip))c.expected_ip='119.196.240.0/24';
 const ip=c.expected_ip.match(/^119\.196\.240\.(\d{1,3})(?:\/(\d{1,2}))?$/);if(!ip||Number(ip[1])>255||(ip[2]&&(Number(ip[2])<24||Number(ip[2])>32)))throw Error('허용 IP는 119.196.240.* 범위 안에서 지정하세요. 기본값은 119.196.240.0/24입니다.');
 if(c.password_source==='google_sheets'){
  c.sheet_id=sheetID(c.sheet_id);if(!c.sheet_password_range)throw Error('비밀번호 셀을 입력하세요.');
  for(const k of ['sheet_username_range','sheet_password_range','sheet_date_range'])if(c[k]&&(c[k].length>180||!/^.+!\$?[A-Za-z]+\$?[1-9]\d*$/.test(c[k])))throw Error('셀은 데이터날짜!A2처럼 시트 이름과 한 칸의 주소로 입력하세요.');
  if(!c.sheet_username_range&&!c.username)throw Error('아이디 셀 또는 고정 타임넷 아이디를 입력하세요.');
  if(!['api_key','service_account'].includes(c.sheet_auth))throw Error('Google 시트 인증 방식을 선택하세요.');
  if(c.sheet_auth==='service_account'){c.service_account=validateService(c.service_account);delete c.google_api_key}
  else{if(!c.google_api_key)throw Error('기존 Google Sheets API 키를 입력하세요. 비공개 시트는 서비스 계정 JSON을 사용하세요.');delete c.service_account}
  delete c.password;
 }else if(!c.username||!c.password)throw Error('타임넷 아이디와 비밀번호를 입력하세요.');
 delete c.center_codes;delete c.rbu_code;delete c._teacher_filter;
 return c;
}
function view(cfg={}){const c={...copy(defaults),...copy(cfg),password_source:mode(cfg),sheet_auth:cfg.sheet_auth||(cfg.service_account?'service_account':'api_key')};c.password_set=Boolean(c.password);c.google_api_key_set=Boolean(c.google_api_key);c.service_account_set=Boolean(c.service_account);delete c.password;delete c.google_api_key;delete c.service_account;return c}
function teacherName(cfg,user){return text(cfg.teacher_names?.[user.id]||user.name)}
function pcConfig(cfg={},user){if(!cfg.password_source&&!cfg.sheet_id&&!cfg.password)throw Error('최고관리자가 타임넷 공통 연결을 먼저 설정해야 합니다.');const c=copy(cfg);if(user.role==='teacher'){if(c.shared_enabled===false)throw Error('최고관리자가 강사용 타임넷 공통 연결을 꺼 두었습니다.');c._teacher_filter=teacherName(c,user);if(!c._teacher_filter)throw Error('최고관리자가 타임넷 담임 이름을 설정해야 합니다.')}else delete c._teacher_filter;delete c.teacher_names;delete c.shared_enabled;return c}
// Recover literal settings only. Imported Python is never evaluated or executed.
function parseSources(files){
 const found=Object.create(null);if(!files.length||files.length>12)throw Error('기존 설정 파일을 선택하세요.');
 for(const file of files){if(file.text.length>150000)throw Error('설정 파일이 너무 큽니다.');
  if(file.name.toLowerCase().endsWith('.json')){let o;try{o=JSON.parse(file.text)}catch{throw Error('JSON 설정 파일을 읽지 못했습니다.')};if(o.type==='service_account'){found.service_account=validateService(o);continue}if(o.format!=='mirae-timenet-config-v1'||!o.constants)throw Error('기존 타임넷 연결 설정 JSON 또는 Google 서비스 계정 JSON을 선택하세요.');Object.assign(found,o.constants);continue}
  if(!file.name.toLowerCase().endsWith('.py'))throw Error('.py 또는 .json 설정 파일을 선택하세요.');
  for(const k of ['SPREADSHEET_ID','API_KEY','ADMIN_ID']){
   const re=new RegExp('^'+k+'\\s*=\\s*([\"\'])([^\\r\\n]*?)\\1\\s*(?:#.*)?$','m'),m=file.text.match(re);
   if(m&&!/[\\\r\n]/.test(m[2])&&!m[2].includes(m[1]))found[k]=m[2];
  }
  const m=file.text.match(/^ACAD_CODES\s*=\s*\{([^}]{1,10000})\}/m);if(m){const codes=[...m[1].matchAll(/["'](TE\d{8})["']\s*:/g)].map(x=>x[1]);if(codes.length)found.ACAD_CODES=Object.fromEntries(codes.map(x=>[x,'']))}
 }
 const result={};for(const [k,to]of Object.entries({SPREADSHEET_ID:'sheet_id',API_KEY:'google_api_key',ADMIN_ID:'username'}))if(typeof found[k]==='string')result[to]=found[k];
 if(found.ACAD_CODES&&typeof found.ACAD_CODES==='object')result.centers=Object.keys(found.ACAD_CODES);
 if(found.service_account){result.service_account=found.service_account;result.sheet_auth='service_account'}else if(result.google_api_key)result.sheet_auth='api_key';
 if(!Object.keys(result).length)throw Error('설정 상수를 찾지 못했습니다. 원본 sheets_client·timenet_client 파일 또는 연결 설정 JSON을 선택하세요.');
 return{password_source:'google_sheets',...(result.sheet_id?{sheet_password_range:'데이터날짜!A2',sheet_date_range:'데이터날짜!A1'}:{}),...(result.username?{sheet_username_range:''}:{}),...result};
}
window.MiraeTimeNet={defaults,normalize,view,pcConfig,teacherName,parseSources};
})();
