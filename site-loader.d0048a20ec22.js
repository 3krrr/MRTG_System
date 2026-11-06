(()=>{'use strict';
if(window.MiraeEntry19?.blocked)return;
window.MiraeWebLoading38=true;
const config=window.MIRAE_CONFIG,controller=new AbortController();
let timer=setTimeout(()=>controller.abort(),25000);
function fail(){
 window.MiraeWebFailure38=true;
 const box=document.getElementById('entry19');if(!box)return;
 box.setAttribute('data-failed','true');
 document.getElementById('entry19-title').textContent='클래스룸 서버에 연결하지 못했습니다';
 document.getElementById('entry19-message').textContent='잠시 후 다시 열기를 눌러 주세요. 계속 연결되지 않으면 학원에 알려 주세요.';
}
function load(tag,asset,base){return new Promise((resolve,reject)=>{
 const e=document.createElement(tag),url=new URL(asset.file,base);
 e.crossOrigin='anonymous';e.integrity=asset.integrity;
 if(tag==='link'){e.rel='stylesheet';e.href=url.href}else{e.src=url.href;e.async=false}
 const stop=()=>{e.remove();finish(Error('cancelled'))};
 function finish(error){e.onload=e.onerror=null;controller.signal.removeEventListener('abort',stop);error?reject(error):resolve()}
 e.onload=()=>finish();e.onerror=()=>finish(Error('asset'));
 controller.signal.addEventListener('abort',stop,{once:true});
 if(controller.signal.aborted){stop();return}document.head.append(e);
})}
function valid(asset,kind){return asset&&new RegExp('^classroom\\.[a-f0-9]{12}\\.'+kind+'$').test(asset.file)&&/^sha384-[A-Za-z0-9+/]{64}$/.test(asset.integrity)&&Number.isInteger(asset.bytes)&&asset.bytes>0&&asset.bytes<10000000}
(async()=>{
 const base=new URL(String(config?.SUPABASE_URL||''));
 if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||!(base.protocol==='https:'||base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname)))throw Error('address');
 const response=await fetch(new URL('web-release.json',base),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
 if(!response.ok)throw Error('manifest');
 if(Number(response.headers.get('Content-Length'))>8192)throw Error('manifest');
 const body=await response.text();if(body.length>8192)throw Error('manifest');
 const release=JSON.parse(body);
 if(release.schema!==1||!/^\d{6}_\d+$/.test(release.version)||!valid(release.script,'js')||!valid(release.style,'css'))throw Error('manifest');
 await load('link',release.style,base);
 await load('script',release.script,base);
 window.MiraeWebRelease38=release.version;
})().catch(fail).finally(()=>{clearTimeout(timer);timer=null;window.MiraeWebLoading38=false});
})();
