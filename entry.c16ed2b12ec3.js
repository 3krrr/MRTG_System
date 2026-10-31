(function(w,d){
'use strict';
// Keep this entry script ES5-compatible and independent of the application bundle.
var entry=w.MiraeEntry19={blocked:false,redirecting:false,ready:false,error:''},timer,observer;
var local=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname),ua=navigator.userAgent||'',android=/Android/i.test(ua),ios=/iPhone|iPad|iPod/i.test(ua),embedded=/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(ua);
var secureURL=location.href.replace(/^http:/,'https:');
if(location.protocol==='http:'&&!local){entry.blocked=true;entry.redirecting=true;location.replace(secureURL);}
function hasScreen(){var app=d.getElementById('app');return !!(app&&app.children.length&&app.textContent.replace(/\s/g,'').length);}
function ready(){if(entry.blocked||!hasScreen())return false;entry.ready=true;clearTimeout(timer);if(observer)observer.disconnect();var box=d.getElementById('entry19');if(box)box.parentNode.removeChild(box);return true;}
function fail(code){if(entry.ready||ready())return;entry.error=code;var box=d.getElementById('entry19');if(!box)return;box.setAttribute('data-failed','true');var brand=d.getElementById('startup-brand');if(brand)brand.parentNode.removeChild(brand);d.getElementById('entry19-title').textContent='클래스룸을 열지 못했습니다';d.getElementById('entry19-message').textContent=embedded?'카카오톡 등 앱 안에서 열리지 않으면 다른 브라우저로 이어서 열어 주세요.':'다시 열기를 눌러 주세요. 계속 열리지 않으면 브라우저를 업데이트해 주세요.';}
function set(name,obj,value){try{Object.defineProperty(obj,name,{configurable:true,writable:true,value:value});}catch(e){try{obj[name]=value;}catch(ignore){}}}
if(!entry.blocked){
 try{
  if(!w.crypto||typeof w.crypto.getRandomValues!=='function'||!w.Uint8Array||!w.fetch||!w.Promise||!w.URL||!w.AbortController)throw Error('BROWSER_UNSUPPORTED');
  if(typeof w.crypto.randomUUID!=='function')set('randomUUID',w.crypto,function(){var bytes=new Uint8Array(16),out=[],i;w.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;for(i=0;i<16;i++)out.push((bytes[i]+256).toString(16).slice(1));return out.slice(0,4).join('')+'-'+out.slice(4,6).join('')+'-'+out.slice(6,8).join('')+'-'+out.slice(8,10).join('')+'-'+out.slice(10).join('');});
  if(typeof w.crypto.randomUUID!=='function')throw Error('BROWSER_UNSUPPORTED');
  if(typeof w.AbortSignal.timeout!=='function')set('timeout',w.AbortSignal,function(ms){var c=new AbortController(),t=setTimeout(function(){var e;try{e=new DOMException('Request timed out','TimeoutError');}catch(ignore){e=new Error('Request timed out');e.name='TimeoutError';}c.abort(e);},Math.max(0,Number(ms)||0));c.signal.addEventListener('abort',function(){clearTimeout(t);},{once:true});return c.signal;});
  var at=function(index){var n=Number(index)||0;n=n<0?Math.ceil(n):Math.floor(n);if(n<0)n+=this.length;return n<0||n>=this.length?undefined:this[n];};
  if(!Array.prototype.at)set('at',Array.prototype,at);
  if(!String.prototype.at)set('at',String.prototype,at);
 }catch(e){entry.blocked=true;entry.error='BROWSER_UNSUPPORTED';}
}
w.addEventListener('error',function(e){if(!entry.ready&&(e.message||(e.target&&e.target.tagName==='SCRIPT')))fail('BROWSER_START');},true);
w.addEventListener('unhandledrejection',function(){if(!entry.ready)fail('BROWSER_START');});
function mount(){
 var box=d.getElementById('entry19');if(!box)return;
 var address=d.getElementById('entry19-url'),open=d.getElementById('entry19-external'),hint=d.getElementById('entry19-hint'),reload=d.getElementById('entry19-reload'),copy=d.getElementById('entry19-copy');
 address.value=secureURL;reload.href=secureURL;
 // App launch stays in a direct tap. Never open or close an external browser automatically.
 if(android&&/^https:\/\//.test(secureURL)){open.hidden=false;open.textContent='Chrome에서 열기';open.href='intent://'+secureURL.replace(/^https:\/\//,'').split('#')[0]+'#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url='+encodeURIComponent(secureURL)+';end';open.onclick=function(){hint.textContent='열리지 않으면 카카오톡 메뉴의 다른 브라우저로 열기를 누르거나 주소를 복사해 Chrome 주소창에 붙여넣어 주세요.';};}
 if(ios)hint.textContent='카카오톡 메뉴에서 다른 브라우저로 열기를 선택하세요. 또는 주소를 복사해 Safari 주소창에 붙여넣어 주세요.';
 function selectedCopy(){address.focus();address.select();address.setSelectionRange(0,address.value.length);var ok=false;try{ok=d.execCommand('copy');}catch(e){}hint.textContent=ok?'주소를 복사했습니다. '+(ios?'Safari':'Chrome')+' 주소창에 붙여넣어 주세요.':'아래 주소를 길게 눌러 복사한 뒤 '+(ios?'Safari':'Chrome')+'에서 열어 주세요.';}
 copy.onclick=function(){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(secureURL).then(function(){hint.textContent='주소를 복사했습니다. '+(ios?'Safari':'Chrome')+' 주소창에 붙여넣어 주세요.';},selectedCopy);return;}}catch(e){}selectedCopy();};
 if(entry.error||entry.redirecting)fail(entry.error||'HTTPS_REDIRECT');
 if(ready())return;
 if(w.MutationObserver){observer=new MutationObserver(ready);observer.observe(d.getElementById('app'),{childList:true,subtree:true});}
 timer=setTimeout(function(){if(!ready())fail('BROWSER_START_TIMEOUT');},10000);
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',mount);else mount();
})(window,document);
