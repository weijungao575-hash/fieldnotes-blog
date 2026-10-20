import {regions,STATUS} from './data.js';
const regionIds=new Set(regions.map(r=>r.id));
const idPattern=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/;
export function validateContent(site){
  if(!site||site.formatVersion!==2||!Array.isArray(site.posts)||!site.visits||!site.colors)throw new Error('内容文件结构不正确');
  if(site.posts.length>20000)throw new Error('文章数量过多');
  for(const [id,status] of Object.entries(site.visits))if(!regionIds.has(id)||!Object.hasOwn(STATUS,status))throw new Error('足迹状态无效');
  for(const [id,color] of Object.entries(site.colors))if(!regionIds.has(id)||!/^#[a-f0-9]{6}$/i.test(color))throw new Error('地区颜色无效');
  const seen=new Set();
  for(const p of site.posts){
    if(!p||!idPattern.test(p.id)||seen.has(p.id)||typeof p.title!=='string'||p.title.length>140||!p.title.trim()||typeof p.excerpt!=='string'||!['essay','travel'].includes(p.type)||p.status!=='published'||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Array.isArray(p.regions)||!p.regions.every(id=>regionIds.has(id))||p.type==='travel'&&!p.regions.length||!Array.isArray(p.body))throw new Error('文章格式无效');
    seen.add(p.id);
    for(const b of p.body)if(!b||!['p','h2','quote','image'].includes(b.type)||b.type==='image'&&typeof b.src!=='string'||b.text!==undefined&&typeof b.text!=='string'||b.html!==undefined&&typeof b.html!=='string')throw new Error('正文格式无效');
  }
  return structuredClone(site);
}
export const DRAFT_KEY='fieldnotes-private-drafts-v2';
export function loadDrafts(storage=globalThis.localStorage){try{const value=JSON.parse(storage.getItem(DRAFT_KEY));if(Array.isArray(value))return value.filter(p=>p&&idPattern.test(p.id)&&typeof p.title==='string'&&Array.isArray(p.body)&&Array.isArray(p.regions)&&p.status==='draft');}catch{}return [];}
export function saveDrafts(drafts,storage=globalThis.localStorage){storage.setItem(DRAFT_KEY,JSON.stringify(drafts));}
export function editingPosts(site,drafts){const localIds=new Set(drafts.map(p=>p.id));return [...drafts,...site.posts.filter(p=>!localIds.has(p.id))].sort((a,b)=>b.date.localeCompare(a.date));}
