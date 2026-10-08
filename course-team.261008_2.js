(function(root){'use strict';
function assistants(c){return [...new Set([...(Array.isArray(c?.assistant_teacher_ids)?c.assistant_teacher_ids:[]),c?.assistant_teacher_id].filter(id=>id&&id!==c?.teacher_id))]}
function members(c){return [c?.teacher_id,...assistants(c)].filter(Boolean)}
function has(c,id){return !!id&&members(c).includes(id)}
function validate(c){const ids=assistants(c);if(ids.length>5||ids.some(id=>typeof id!=='string'))throw Error('부담임은 서로 다른 강사로 최대 5명까지 지정하세요.');return ids}
const api={VERSION:'261008_2',assistants,members,has,validate};root.MiraeTeam=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
