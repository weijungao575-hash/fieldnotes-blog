import {validateContent} from './content-model.js';
// The only remote write destination. Tokens never enter content files or URLs.
export const GITHUB = Object.freeze({
  owner:'weijungao575-hash', repo:'fieldnotes-blog', branch:'main', file:'content.json',
  url:'https://github.com/weijungao575-hash/fieldnotes-blog',
  site:'https://weijungao575-hash.github.io/fieldnotes-blog/'
});
export class GitHubError extends Error {
  constructor(message,status=0){super(message);this.name='GitHubError';this.status=status;}
}
export const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item);
export function textToBase64(text){const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
export function base64ToText(content){const binary=atob(content.replace(/\s/g,''));return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));}
export function mapValue(site,id){return {status:site.visits[id]||'none',color:site.colors?.[id]||null};}
const published=site=>({...structuredClone(site),posts:site.posts.filter(p=>p.status==='published').map(p=>structuredClone(p))});

export class GitHubRepository {
  #token; #fetch; #busy=false;
  constructor(token,{fetch:fetchImpl=globalThis.fetch}={}){this.#token=token.trim();this.#fetch=fetchImpl;if(!this.#token)throw new GitHubError('请先输入 GitHub 访问令牌');}
  disconnect(){this.#token='';}
  async request(path,{method='GET',body}={}){
    if(!this.#token)throw new GitHubError('请重新连接 GitHub');
    const url=`https://api.github.com${path}`;
    let response;
    try{response=await this.#fetch(url,{method,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.#token}`,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(45000)});}catch{throw new GitHubError('连接 GitHub 失败，请检查网络后重试；编辑内容仍保留在本页');}
    if(!response.ok){
      const messages={401:'令牌无效或已过期，请重新连接 GitHub',403:'GitHub 拒绝访问：请确认令牌仅授权此仓库，并具有 Contents 读写权限；也可能触及 API 频率限制',404:'无法访问博客仓库或文件，请检查令牌的仓库授权',409:'仓库有新的修改，请刷新仓库内容后再保存',422:'仓库版本发生变化，尚未覆盖其他修改'};
      throw new GitHubError(messages[response.status]||`GitHub 请求失败（${response.status}），请稍后重试`,response.status);
    }
    return response.json();
  }
  get prefix(){return `/repos/${GITHUB.owner}/${GITHUB.repo}`;}
  async connect(){
    const user=await this.request('/user');
    const repo=await this.request(this.prefix);
    if(!repo.permissions?.push&&!repo.permissions?.admin)throw new GitHubError('这个 GitHub 账号没有此博客仓库的写入权限',403);
    const snapshot=await this.read();
    return {login:user.login,snapshot};
  }
  async read(){
    const ref=await this.request(`${this.prefix}/git/ref/heads/${GITHUB.branch}`);
    const commit=await this.request(`${this.prefix}/git/commits/${ref.object.sha}`);
    const tree=await this.request(`${this.prefix}/git/trees/${commit.tree.sha}`);
    const file=tree.tree.find(entry=>entry.path===GITHUB.file&&entry.type==='blob');
    if(!file)throw new GitHubError('仓库缺少 content.json，请先完成网站升级');
    const blob=await this.request(`${this.prefix}/git/blobs/${file.sha}`);
    let site;try{site=JSON.parse(base64ToText(blob.content));}catch{throw new GitHubError('仓库中的内容文件格式无效，请检查 content.json');}
    if(!site||!Array.isArray(site.posts)||!site.visits||!site.colors)throw new GitHubError('仓库内容结构无效');
    try{site=validateContent(site);}catch{throw new GitHubError('仓库内容校验失败，请检查 content.json');}
    return {head:ref.object.sha,tree:commit.tree.sha,site};
  }
  async #media(post,files){
    const copy=structuredClone(post),cache=new Map();
    const convert=async src=>{
      if(typeof src!=='string'||!src.startsWith('data:image/'))return src;
      if(cache.has(src))return cache.get(src);
      const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(src);
      if(!match)throw new GitHubError('照片格式不支持，请使用 JPG、PNG 或 WebP');
      const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
      if(bytes.length>3*1024*1024)throw new GitHubError('单张压缩后的照片超过 3 MB，请减小尺寸');
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
      const path=`uploads/${hash}.${match[1]==='jpeg'?'jpg':match[1]}`;
      files.set(path,{encoding:'base64',content:match[2]});cache.set(src,path);return path;
    };
    copy.cover=await convert(copy.cover);
    for(const block of copy.body)if(block.type==='image')block.src=await convert(block.src);
    return copy;
  }
  async #commit(transform,{message,operationId,wasApplied}){
    if(this.#busy)throw new GitHubError('上一项保存尚未结束，请稍候');
    this.#busy=true;
    try{
      for(let attempt=0;attempt<2;attempt++){
        const base=await this.read();
        if(wasApplied(base.site,operationId))return {site:base.site,sha:base.head,recovered:true};
        const files=new Map();const site=await transform(published(base.site),files);
        site.revision=operationId;site.updatedAt=new Date().toISOString();site.formatVersion=2;
        validateContent(site);
        files.set(GITHUB.file,{content:JSON.stringify(published(site),null,2)+'\n',encoding:'utf-8'});
        const treeEntries=[];
        for(const [path,file] of files){
          if(path!==GITHUB.file&&!/^uploads\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(path))throw new GitHubError('不允许写入此仓库路径');
          const blob=await this.request(`${this.prefix}/git/blobs`,{method:'POST',body:file});
          treeEntries.push({path,mode:'100644',type:'blob',sha:blob.sha});
        }
        const tree=await this.request(`${this.prefix}/git/trees`,{method:'POST',body:{base_tree:base.tree,tree:treeEntries}});
        const commit=await this.request(`${this.prefix}/git/commits`,{method:'POST',body:{message,tree:tree.sha,parents:[base.head]}});
        try{
          await this.request(`${this.prefix}/git/refs/heads/${GITHUB.branch}`,{method:'PATCH',body:{sha:commit.sha,force:false}});
          return {site:published(site),sha:commit.sha};
        }catch(error){
          // A lost response can still mean the update succeeded. Reconcile first.
          let latest;
          try{latest=await this.read();}catch{throw error;}
          if(wasApplied(latest.site,operationId))return {site:latest.site,sha:latest.head,recovered:true};
          if(latest.head!==base.head&&attempt===0)continue;
          throw error;
        }
      }
      throw new GitHubError('保存时仓库再次发生变化，请重新加载后再试',409);
    }finally{this.#busy=false;}
  }
  async publishPost(post,{expected=null,operationId=crypto.randomUUID()}={}){
    if(post.status!=='published')throw new GitHubError('草稿只能保存到本机，点击发布后才上传');
    return this.#commit(async(site,files)=>{
      const current=site.posts.find(p=>p.id===post.id)||null;
      if(canonical(current)!==canonical(expected))throw new GitHubError('这篇文章已在其他设备或 GitHub 中修改。请先保存本机草稿，再重新加载仓库版本',409);
      const prepared=await this.#media(post,files);prepared.version=operationId;
      const index=site.posts.findIndex(p=>p.id===post.id);if(index<0)site.posts.push(prepared);else site.posts[index]=prepared;
      return site;
    },{message:`Publish: ${post.title}`,operationId,wasApplied:(site,id)=>site.posts.some(p=>p.id===post.id&&p.version===id)});
  }
  async saveMap(changes,{operationId=crypto.randomUUID()}={}){
    if(!changes.length)throw new GitHubError('没有需要保存的足迹修改');
    return this.#commit(async site=>{
      for(const change of changes){
        if(canonical(mapValue(site,change.id))!==canonical(change.expected))throw new GitHubError('这个地区已在其他设备修改，请重新加载仓库数据后再编辑',409);
        site.visits[change.id]=change.status;
        if(change.color)site.colors[change.id]=change.color;else delete site.colors[change.id];
      }
      site.mapRevision=operationId;return site;
    },{message:`Update travel map (${changes.length} regions)`,operationId,wasApplied:(site,id)=>site.mapRevision===id});
  }
}
