(()=>{'use strict';const enc=new TextEncoder();function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function zip(files){const chunks=[],centers=[];let offset=0;for(const f of files){const name=enc.encode(f.name),body=f.bytes,h=new Uint8Array(30+name.length),v=new DataView(h.buffer),sum=crc(body);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,name.length,true);h.set(name,30);chunks.push(h,body);const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,sum,true);w.setUint32(20,body.length,true);w.setUint32(24,body.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);centers.push(c);offset+=h.length+body.length}const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centers.reduce((s,c)=>s+c.length,0),true);e.setUint32(16,offset,true);return new Blob([...chunks,...centers,end],{type:'application/zip'})}
async function exportIcons(image,androidImage=null){
 if(!image&&!androidImage)throw Error('변경할 아이콘을 먼저 선택하세요.');
 for(const asset of [image,androidImage])if(asset&&asset.width!==asset.height)throw Error('정사각형 아이콘을 선택하세요.');
 const response=await fetch('mirae.webmanifest',{cache:'no-store'});
 if(!response.ok)throw Error('현재 앱 아이콘 설정을 불러오지 못했습니다.');
 const manifest=await response.json(),files=[],stamp=Date.now();
 async function current(name,src=name){const r=await fetch(src,{cache:'no-store'});if(!r.ok)throw Error('기존 아이콘을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');files.push({name,bytes:new Uint8Array(await r.arrayBuffer())})}
 async function encode(name,size,asset,opaque=false){const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');if(opaque){ctx.fillStyle='#215c3b';ctx.fillRect(0,0,size,size)}ctx.drawImage(asset,0,0,size,size);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('아이콘 파일을 만들지 못했습니다.');files.push({name,bytes:new Uint8Array(await blob.arrayBuffer())})}
 for(const size of [180,192,512]){const name='icons/mirae-'+size+'.png';if(image)await encode(name,size,image);else await current(name)}
 const maskable=(manifest.icons||[]).filter(i=>String(i.purpose||'any').split(' ').includes('maskable'));
 for(const size of [192,512]){
  const name='icons/mirae-android-'+size+'.png';
  if(androidImage)await encode(name,size,androidImage,true);
  else {const old=maskable.find(i=>i.sizes===size+'x'+size)||maskable.find(i=>i.sizes==='512x512');if(!old)throw Error('기존 안드로이드 아이콘이 없습니다. 안드로이드용 이미지를 선택하세요.');const r=await fetch(old.src,{cache:'no-store'});if(!r.ok)throw Error('기존 안드로이드 아이콘을 불러오지 못했습니다.');const blob=await r.blob();if(old.sizes===size+'x'+size)files.push({name,bytes:new Uint8Array(await blob.arrayBuffer())});else{const bitmap=await createImageBitmap(blob);try{await encode(name,size,bitmap,true)}finally{bitmap.close()}}}
 }
 manifest.icons=[... [192,512].map(size=>({src:'icons/mirae-'+size+'.png?icon='+stamp,sizes:size+'x'+size,type:'image/png',purpose:'any'})),... [192,512].map(size=>({src:'icons/mirae-android-'+size+'.png?icon='+stamp,sizes:size+'x'+size,type:'image/png',purpose:'maskable'}))];
 files.push({name:'mirae.webmanifest',bytes:enc.encode(JSON.stringify(manifest,null,2))});
 files.push({name:'아이콘 적용 방법.txt',bytes:enc.encode('압축을 풀고 icons 폴더의 내용과 mirae.webmanifest를 사이트의 같은 위치에 올리세요. 선택하지 않은 플랫폼은 현재 아이콘을 함께 보존합니다. config.js와 CNAME은 유지합니다. Android는 바깥 여백 없는 불투명 정사각형 이미지로 만들고 M 등 주요 내용은 중앙 안전 영역에 두세요. 앱 이름/id/start_url은 유지합니다. 테스트 Android 앱은 제거 후 Chrome에서 다시 설치하면 새 아이콘을 확인하기 쉽습니다. 운영체제별 표시 모양은 실물 기기에서 확인하세요.')});
 const url=URL.createObjectURL(zip(files)),a=document.createElement('a');a.href=url;a.download='미래탐구_아이콘_업데이트.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
window.MiraeIconExport={export:exportIcons,zip};})();
