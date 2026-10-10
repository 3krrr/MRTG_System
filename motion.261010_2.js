/* Shared, interruptible disclosure motion. Closed contents remain out of keyboard focus. */
(()=>{'use strict';
const pending=new WeakMap();
function fold(node,open){
 if(!node)return;
 const previous=pending.get(node);
 if(previous){cancelAnimationFrame(previous.frame);clearTimeout(previous.timer);node.removeEventListener('transitionend',previous.end);pending.delete(node)}
 const height=node.getBoundingClientRect().height;
 const immediate=matchMedia('(prefers-reduced-motion:reduce)').matches;
 node.inert=!open;node.setAttribute('aria-hidden',String(!open));
 if(immediate){node.classList.toggle('is-open',open);node.style.height='';node.style.visibility='';node.style.transition='';return}
 node.style.height=height+'px';node.style.visibility='visible';node.style.transition='none';
 node.getBoundingClientRect();
 node.classList.toggle('is-open',open);
 const target=open?(node.firstElementChild?.scrollHeight||node.scrollHeight):0;
 node.getBoundingClientRect();node.style.transition='';
 const state={frame:0,timer:0,end:null};
 function done(){if(pending.get(node)!==state)return;cancelAnimationFrame(state.frame);clearTimeout(state.timer);node.removeEventListener('transitionend',state.end);node.style.height='';node.style.visibility='';pending.delete(node)}
 state.end=e=>{if(e.target===node&&e.propertyName==='height')done()};
 pending.set(node,state);node.addEventListener('transitionend',state.end);
 state.frame=requestAnimationFrame(()=>{node.style.height=target+'px';if(Math.abs(target-height)<.5){done();return}state.timer=setTimeout(done,650)});
}
window.MiraeMotion={VERSION:'261010_2',fold};
})();
