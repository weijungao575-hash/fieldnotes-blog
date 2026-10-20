import test from 'node:test';
import assert from 'node:assert/strict';
import {regions,STATUS,seedPosts,defaultVisits} from './data.js';
import {MAP_SOURCE,MAP_VIEWBOX} from './geography.js';
import {loadState,saveState,publishedPosts,regionPosts,visitStats,validatePost,validateImport} from './store.js';

test('真实轮廓完整覆盖 34 个中国地区与 47 个日本都道府县，稳定 ID 与有效路径保留',()=>{
 assert.equal(regions.filter(r=>r.country==='cn').length,34);
 assert.equal(regions.filter(r=>r.country==='jp').length,47);
 assert.equal(new Set(regions.map(r=>r.id)).size,81);
 for(const r of regions){assert.match(r.path,/^M/);assert.ok(r.path.endsWith('Z'));assert.ok(!/NaN|undefined|Infinity/.test(r.path));assert.ok(r.path.match(/[ML]/g).length>12,`${r.id} must have a geographic outline`);assert.ok(r.bounds.every(Number.isFinite));assert.ok(r.bounds[2]>0&&r.bounds[3]>0);assert.ok(Number.isFinite(r.x)&&Number.isFinite(r.y));const [,,w,h]=MAP_VIEWBOX[r.country].split(' ').map(Number),coordinates=r.path.match(/-?\d+(?:\.\d+)?/g).map(Number);for(let i=0;i<coordinates.length;i+=2){assert.ok(coordinates[i]>=0&&coordinates[i]<=w,`${r.id} x outside map`);assert.ok(coordinates[i+1]>=0&&coordinates[i+1]<=h,`${r.id} y outside map`);}}
 assert.ok(regions.some(r=>r.id==='cn-81'));assert.ok(regions.some(r=>r.id==='cn-82'));assert.ok(regions.some(r=>r.id==='cn-71'));assert.ok(regions.some(r=>r.id==='jp-47'));
});
test('地理数据有来源，离岛与省级特殊地区保留多块真实轮廓',()=>{
 assert.equal(MAP_SOURCE.name,'Natural Earth');assert.equal(MAP_SOURCE.license,'Public domain');assert.match(MAP_SOURCE.adminSHA256,/^[a-f0-9]{64}$/);
 for(const id of ['jp-01','jp-13','jp-47','cn-31','cn-71','cn-81'])assert.ok(regions.find(r=>r.id===id).path.split('M').length>2,`${id} retains islands or enlarged geographic detail`);
 assert.equal(regions.find(r=>r.id==='cn-81').miniPath.includes('undefined'),false);
});
test('跨地区文章可出现在多个地区，草稿永不进入公开列表或地区页',()=>{
 const state={posts:[{id:'multi',status:'published',date:'2026-10-20',regions:['cn-33','jp-26']},{id:'draft',status:'draft',date:'2026-10-21',regions:['cn-33']}]};
 assert.deepEqual(publishedPosts(state).map(p=>p.id),['multi']);
 assert.deepEqual(regionPosts(state,'cn-33').map(p=>p.id),['multi']);
 assert.deepEqual(regionPosts(state,'jp-26').map(p=>p.id),['multi']);
});
test('到访数只包括到访与居住，地区颜色与文章数互不依赖',()=>{
 const state={visits:{'cn-11':'visited','cn-31':'lived','cn-33':'transit','cn-53':'wish'},colors:{'cn-33':'#ffffff'},posts:[]};
 assert.equal(visitStats(state,'cn').been,2);assert.equal(visitStats(state,'cn').wish,1);assert.equal(visitStats(state,'jp').been,0);assert.equal(visitStats(state).total,81);
});
test('浏览器备份往返不损失正文、图片或自定义地区颜色',()=>{
 const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const state=loadState(storage);state.colors['jp-26']='#eebb99';state.posts[0].body.push({type:'image',src:'data:image/jpeg;base64,YQ==',alt:'照片'});
 saveState(state,storage);assert.deepEqual(loadState(storage),state);assert.ok(validateImport(JSON.parse([...map.values()][0])));
});
test('旅行文章需要关联地区，标题和正文不能为空；随笔不需要地区',()=>{
 const p={title:'测试文章',type:'travel',regions:[],body:[{type:'p',text:'正文'}]};
 assert.match(validatePost(p),/地区/);assert.equal(validatePost({...p,regions:['cn-33']}),null);assert.equal(validatePost({...p,type:'essay'}),null);assert.match(validatePost({...p,title:' '}),/标题/);assert.match(validatePost({...p,type:'essay',body:[]}),/正文/);
});
test('无效备份不会被接受，示例内容所有关联引用有效',()=>{
 assert.equal(validateImport({posts:[{title:'broken'}],visits:{}}),false);assert.equal(validateImport({posts:[],visits:{'bad':'visited'}}),false);assert.equal(validateImport({posts:[],visits:{'cn-11':'unknown'}}),false);
 assert.ok(validateImport({posts:seedPosts,visits:defaultVisits}));
 for(const p of seedPosts)for(const id of p.regions)assert.ok(regions.some(r=>r.id===id));
 for(const [id,status] of Object.entries(defaultVisits)){assert.ok(regions.some(r=>r.id===id));assert.ok(STATUS[status]);}
});
