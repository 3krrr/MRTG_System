(()=>{'use strict';
let frame;
const mobile=()=>!!window.MiraePC?.isMobile;
function viewport(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
 if(!mobile())return;
 const vv=window.visualViewport,height=vv?.height||innerHeight,offset=vv?.offsetTop||0;
 const root=document.documentElement;
 root.style.setProperty('--login-viewport',Math.round(height)+'px');
 root.style.setProperty('--login-offset',Math.round(offset)+'px');
 root.classList.toggle('login-keyboard',height<460||height<innerHeight*.78);
})}
window.visualViewport?.addEventListener('resize',viewport);
window.visualViewport?.addEventListener('scroll',viewport);
window.addEventListener('resize',viewport);
new MutationObserver(viewport).observe(document.querySelector('#app'),{childList:true,subtree:true});
viewport();
function locked(e){return mobile()&&document.body.classList.contains('at-login')&&!e.target.closest('.pwa-help,.modal-overlay,.inline-error')}
for(const event of ['touchmove','wheel'])document.addEventListener(event,e=>{if(locked(e))e.preventDefault()},{passive:false});
document.addEventListener('gesturestart',e=>{if(locked(e))e.preventDefault()},{passive:false});
})();
