import {defaultVisits,seedPosts,regions,STATUS} from './data.js';
export const STORAGE_KEY='fieldnotes-prototype-v1';
const initial=()=>({visits:{...defaultVisits},colors:{},posts:structuredClone(seedPosts)});
export function loadState(storage=globalThis.localStorage){
 try { const data=JSON.parse(storage.getItem(STORAGE_KEY)); if(data&&Array.isArray(data.posts)&&data.visits) return {...initial(),...data}; } catch{}
 return initial();
}
export function saveState(state,storage=globalThis.localStorage){storage.setItem(STORAGE_KEY,JSON.stringify(state));}
export function publishedPosts(state){return state.posts.filter(p=>p.status==='published').sort((a,b)=>b.date.localeCompare(a.date));}
export function regionPosts(state,id){return publishedPosts(state).filter(p=>p.regions.includes(id));}
export function visitStats(state,country){const items=regions.filter(r=>!country||r.country===country);return {total:items.length,been:items.filter(r=>['visited','lived'].includes(state.visits[r.id])).length,wish:items.filter(r=>state.visits[r.id]==='wish').length};}
export function validatePost(post){if(!post.title.trim())return '请为文章写一个标题';if(post.type==='travel'&&!post.regions.length)return '请至少选择一个旅行地区';if(!post.body.some(b=>b.text?.trim()||b.type==='image'))return '请添加正文或照片';return null;}
export function validateImport(data){return !!data&&typeof data.visits==='object'&&Array.isArray(data.posts)&&data.posts.every(p=>typeof p.id==='string'&&typeof p.title==='string'&&['draft','published'].includes(p.status)&&['travel','essay'].includes(p.type)&&Array.isArray(p.body)&&Array.isArray(p.regions)&&typeof p.date==='string')&&Object.entries(data.visits).every(([id,status])=>regions.some(r=>r.id===id)&&Object.hasOwn(STATUS,status));}
