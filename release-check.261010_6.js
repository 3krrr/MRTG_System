(()=>{'use strict';
const expected='261010_6',root=new URL('./',document.currentScript.src),started=Date.now();
const modules=['MiraeDrafts','MiraeWorkflow','MiraeSubject','MiraeOversight','MiraeOversightUI','MiraeSMS','MiraePC','MiraeStore','MiraeTimeNet','MiraeProgress','MiraeEnroll','MiraeOverviewUI','MiraeAttendanceCore','MiraeAttendanceOverview'];
const versioned=['MiraeBack','MiraeMakeupStats','MiraeAutoUpdate','MiraeMotion','MiraePolish','MiraeExperience','MiraeMessages','MiraeAudit','MiraeMessenger','MiraeTeam','MiraeStudentAccounts','MiraeLessonVideos','MiraeHomework','MiraeReportNotify','MiraeContacts','MiraeCommunications','MiraeCourses','MiraeInbox','MiraeActivity','MiraeOpening','MiraePush','MiraePushUI','MiraeResources','MiraePlan','MiraeAttendance','MiraeMakeups','MiraeMakeupUI'];
function missing(){const list=modules.filter(name=>!window[name]);for(const name of versioned)if(window[name]?.VERSION!==expected)list.push(name+':version');
 if(window.MiraeAppReady!==true)list.push('app:ready');if(window.MiraeAppVersion!==expected)list.push('app:version');if(!window.MiraeRoles?.CAP.attendance_overview)list.push('permissions');
 for(const sheet of document.querySelectorAll('link[rel=stylesheet]')){const url=new URL(sheet.href,root);if(url.origin===root.origin&&url.pathname.includes('.'+expected+'.')&&!sheet.sheet)list.push(url.pathname.split('/').pop())}
 const marker=getComputedStyle(document.documentElement).getPropertyValue('--mirae-release').replace(/[\s"']/g,'');if(marker!==expected)list.push('style:version');return list}
function refresh(){const url=new URL(location.href);url.searchParams.set('v',expected);url.searchParams.set('reload',String(Date.now()));location.replace(url.href)}
async function recover(list){const flag='mirae-release-repair-'+expected;let attempted=false;try{attempted=sessionStorage.getItem(flag)==='yes';if(!attempted)sessionStorage.setItem(flag,'yes')}catch{attempted=true}
 if(!attempted&&navigator.onLine){try{if('caches'in window){const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('mirae-shell-')).map(key=>caches.delete(key)))}if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.getRegistration(root.href);await registration?.update()}refresh();return}catch{}}
 const el=document.createElement('div');el.className='release-failure';el.innerHTML='<div><h1>사이트 업데이트를 확인해 주세요.</h1><button class="btn primary">새로고침</button><details><summary>문제 확인을 위한 진단 내용</summary><textarea class="input" readonly rows="6" style="width:100%"></textarea></details></div>';
 el.querySelector('button').onclick=refresh;el.querySelector('textarea').value=JSON.stringify(window.MiraeReleaseStatus,null,2);document.body.append(el)}
function check(){const list=missing();window.MiraeReleaseStatus={version:expected,ok:list.length===0,missing:list,checked_at:new Date().toISOString()};if(list.length){if(Date.now()-started<8000){setTimeout(check,200);return}recover(list);return}
 window.MiraeAutoUpdate?.check()}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
})();
