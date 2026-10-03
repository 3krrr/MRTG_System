(()=>{'use strict';const seen=new WeakSet(),collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
function attach(table){if(seen.has(table)||!table.tHead||!table.tBodies[0]||table.closest('.enroll-sheet,.plan-table,.teaching-matrix,.resource-board'))return;seen.add(table);const headers=[...table.tHead.rows].at(-1)?.cells||[];
 for(const [index,th] of [...headers].entries()){if(th.dataset.sort||th.querySelector('input')||!th.textContent.trim()||['관리','보기','확인','상세','발송 결과','강좌 관리'].includes(th.textContent.trim()))continue;th.tabIndex=0;th.classList.add('sortable-index');let descending=false;
  const sort=()=>{descending=th.getAttribute('aria-sort')==='ascending';for(const h of headers)h.removeAttribute('aria-sort');th.setAttribute('aria-sort',descending?'descending':'ascending');const body=table.tBodies[0],rows=[...body.rows];rows.sort((a,b)=>{const av=a.cells[index]?.dataset.sortValue??a.cells[index]?.textContent.trim()??'',bv=b.cells[index]?.dataset.sortValue??b.cells[index]?.textContent.trim()??'';return collator.compare(av,bv)*(descending?-1:1)});body.append(...rows)};th.onclick=sort;th.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();sort()}};
 }
}
let queued=false;function scan(){queued=false;document.querySelectorAll('table').forEach(table=>{attach(table);table.querySelectorAll('tbody td').forEach(td=>{if(!td.closest('.enroll-sheet,.plan-table,.teaching-matrix,.resource-board')&&!td.querySelector('input,textarea,select')&&!td.title)td.title=td.textContent.trim()})})}
new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(scan)}}).observe(document.body,{childList:true,subtree:true});scan();window.MiraeTable={attach};
})();
