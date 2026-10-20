import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubRepository,GITHUB,canonical,mapValue,textToBase64,base64ToText} from './github.js';
import {validateContent,editingPosts,loadDrafts,saveDrafts} from './content-model.js';
import {defaultVisits,seedPosts} from './data.js';

const initial=()=>({formatVersion:2,revision:'initial',visits:{...defaultVisits},colors:{},posts:structuredClone(seedPosts)});
const newPost=(id='test-post')=>({id,title:'京都与浙江 · 测试文章',excerpt:'跨地区、中文与 emoji 🌿',type:'travel',regions:['jp-26','cn-33'],date:'2026-10-21',cover:'assets/lake.svg',status:'published',body:[{type:'p',text:'测试正文'}]});

class FakeGitHub {
  blobs=new Map();trees=new Map();commits=new Map();requests=[];counter=0;nextPatchConflict=null;losePatchResponse=false;failImage=false;tokenInvalid=false;head;
  id(){return (++this.counter).toString(16).padStart(40,'0');}
  constructor(){const content=this.blob(JSON.stringify(initial()));const page=this.blob('website-v2');const tree=this.id();this.trees.set(tree,{'content.json':content,'index.html':page});this.head=this.id();this.commits.set(this.head,{tree:{sha:tree},parents:[]});}
  blob(text){const sha=this.id();this.blobs.set(sha,{content:textToBase64(text),encoding:'base64'});return sha;}
  site(){const commit=this.commits.get(this.head),entries=this.trees.get(commit.tree.sha);return JSON.parse(base64ToText(this.blobs.get(entries['content.json']).content));}
  files(){return this.trees.get(this.commits.get(this.head).tree.sha);}
  externalEdit(edit){const site=this.site();edit(site);const base=this.commits.get(this.head);const entries={...this.trees.get(base.tree.sha),'content.json':this.blob(JSON.stringify(site))};const tree=this.id();this.trees.set(tree,entries);const head=this.id();this.commits.set(head,{tree:{sha:tree},parents:[this.head]});this.head=head;}
  fetch=async(url,options={})=>{
    const method=options.method||'GET',body=options.body?JSON.parse(options.body):undefined,path=new URL(url).pathname;
    this.requests.push({url,method,body,headers:options.headers});
    const ok=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
    if(this.tokenInvalid)return ok({},401);
    if(path==='/user')return ok({login:GITHUB.owner});
    const prefix=`/repos/${GITHUB.owner}/${GITHUB.repo}`;
    if(path===prefix)return ok({permissions:{push:true}});
    if(path===prefix+'/git/ref/heads/main')return ok({object:{sha:this.head}});
    let match;
    if(method==='GET'&&(match=path.match(/\/git\/commits\/([^/]+)$/)))return ok(this.commits.get(match[1]));
    if(method==='GET'&&(match=path.match(/\/git\/trees\/([^/]+)$/)))return ok({tree:Object.entries(this.trees.get(match[1])).map(([path,sha])=>({path,sha,type:'blob'}))});
    if(method==='GET'&&(match=path.match(/\/git\/blobs\/([^/]+)$/)))return ok(this.blobs.get(match[1]));
    if(method==='POST'&&path.endsWith('/git/blobs')){if(this.failImage&&body.encoding==='base64')return ok({},500);const sha=this.id();this.blobs.set(sha,{content:body.encoding==='base64'?body.content:textToBase64(body.content),encoding:'base64'});return ok({sha},201);}
    if(method==='POST'&&path.endsWith('/git/trees')){const entries={...this.trees.get(body.base_tree)};for(const entry of body.tree)entries[entry.path]=entry.sha;const sha=this.id();this.trees.set(sha,entries);return ok({sha},201);}
    if(method==='POST'&&path.endsWith('/git/commits')){const sha=this.id();this.commits.set(sha,{tree:{sha:body.tree},parents:body.parents});return ok({sha},201);}
    if(method==='PATCH'&&path.endsWith('/git/refs/heads/main')){
      if(this.nextPatchConflict){const edit=this.nextPatchConflict;this.nextPatchConflict=null;this.externalEdit(edit);return ok({},422);}
      assert.equal(body.force,false,'Must never force-push');
      if(this.commits.get(body.sha).parents[0]!==this.head)return ok({},422);
      this.head=body.sha;
      if(this.losePatchResponse){this.losePatchResponse=false;throw new TypeError('Network response lost');}
      return ok({object:{sha:this.head}});
    }
    throw Error('Unexpected request '+method+' '+path);
  };
}
const client=server=>new GitHubRepository('dummy-token-only-for-tests',{fetch:server.fetch});

test('Chinese and emoji round-trip through GitHub base64 blobs',()=>{const text='山海之间 🌿\n京都與東京';assert.equal(base64ToText(textToBase64(text)),text);});
test('real connection flow checks identity, repository write access and latest content',async()=>{const server=new FakeGitHub();const connected=await client(server).connect();assert.equal(connected.login,GITHUB.owner);assert.equal(connected.snapshot.site.posts.length,seedPosts.length);});
test('browser fetch is invoked without the repository as its receiver',async()=>{
  const server=new FakeGitHub();
  function browserFetch(url,options){
    if(this!==undefined)throw new TypeError('Illegal invocation');
    return server.fetch(url,options);
  }
  const connected=await new GitHubRepository('dummy-token-only-for-tests',{fetch:browserFetch}).connect();
  assert.equal(connected.login,GITHUB.owner);
});
test('publish writes photo and multi-region article atomically, preserving website and unrelated posts',async()=>{
  const server=new FakeGitHub(),beforePage=server.files()['index.html'];
  const photo='data:image/jpeg;base64,'+btoa('image-binary');const post=newPost();post.cover=photo;post.body.push({type:'image',src:photo,alt:'照片'});
  const result=await client(server).publishPost(post,{operationId:'publish-one'});const actual=server.site().posts.find(p=>p.id===post.id);
  assert.equal(actual.title,post.title);assert.deepEqual(actual.regions,['jp-26','cn-33']);assert.match(actual.cover,/^uploads\/[a-f0-9]{64}\.jpg$/);assert.equal(actual.body[1].src,actual.cover);assert.equal(server.site().posts.length,seedPosts.length+1);assert.equal(server.files()['index.html'],beforePage);assert.ok(server.files()[actual.cover]);assert.equal(result.sha,server.head);
  assert.equal(server.requests.filter(r=>r.method==='POST'&&r.url.endsWith('/git/blobs')&&r.body.encoding==='base64').length,1,'Same cover/body image uploaded only once');
  assert.ok(!JSON.stringify(server.site()).includes('data:image/'));
});
test('failed photo upload never changes public branch or content',async()=>{const server=new FakeGitHub(),head=server.head;server.failImage=true;const post=newPost();post.cover='data:image/jpeg;base64,'+btoa('photo');await assert.rejects(client(server).publishPost(post),/500/);assert.equal(server.head,head);assert.equal(server.site().posts.length,seedPosts.length);});
test('stale edit of the same article is refused, no forced overwrite',async()=>{const server=new FakeGitHub(),expected=structuredClone(server.site().posts[0]);server.externalEdit(site=>site.posts[0].title='Changed on another device');const head=server.head;await assert.rejects(client(server).publishPost({...expected,title:'My edit'},{expected}),/其他设备/);assert.equal(server.head,head);assert.equal(server.site().posts[0].title,'Changed on another device');});
test('unrelated concurrent commit is merged by retry without losing either change',async()=>{const server=new FakeGitHub();server.nextPatchConflict=site=>site.posts[0].title='Other article changed';await client(server).publishPost(newPost(),{operationId:'concurrent'});assert.equal(server.site().posts[0].title,'Other article changed');assert.ok(server.site().posts.some(p=>p.id==='test-post'));});
test('concurrent edit of the target article is caught on retry',async()=>{const server=new FakeGitHub(),expected=structuredClone(server.site().posts[0]);server.nextPatchConflict=site=>site.posts[0].title='Someone else saved first';await assert.rejects(client(server).publishPost({...expected,title:'My version'},{expected}),/其他设备/);assert.equal(server.site().posts[0].title,'Someone else saved first');});
test('lost success response is reconciled rather than creating a duplicate article',async()=>{const server=new FakeGitHub();server.losePatchResponse=true;const result=await client(server).publishPost(newPost(),{operationId:'lost-response'});assert.equal(result.recovered,true);assert.equal(server.site().posts.filter(p=>p.id==='test-post').length,1);assert.equal(server.requests.filter(r=>r.method==='PATCH').length,1);});
test('retrying the same publishing operation after reload does not publish twice',async()=>{const server=new FakeGitHub();await client(server).publishPost(newPost(),{operationId:'same-operation'});const head=server.head;const recovered=await client(server).publishPost(newPost(),{operationId:'same-operation'});assert.equal(recovered.recovered,true);assert.equal(server.head,head);assert.equal(server.site().posts.filter(p=>p.id==='test-post').length,1);});
test('map changes preserve independent regions and photos; conflicting region edit is refused',async()=>{const server=new FakeGitHub(),base=server.site(),expected=mapValue(base,'jp-26');server.externalEdit(site=>site.visits['cn-11']='lived');await client(server).saveMap([{id:'jp-26',status:'lived',color:'#123456',expected}],{operationId:'map-1'});assert.equal(server.site().visits['cn-11'],'lived');assert.equal(server.site().colors['jp-26'],'#123456');await assert.rejects(client(server).saveMap([{id:'jp-26',status:'none',color:null,expected}]),/其他设备/);});
test('drafts cannot be uploaded or accepted as public content',async()=>{const server=new FakeGitHub();await assert.rejects(client(server).publishPost({...newPost(),status:'draft'}),/草稿/);assert.equal(server.requests.length,0);const site=initial();site.posts.push({...newPost(),status:'draft'});assert.throws(()=>validateContent(site));});
test('local draft does not replace the public article; draft persistence round-trips privately',()=>{const site=initial(),draft={...site.posts[0],title:'Private new version',status:'draft'};const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};saveDrafts([draft],storage);const loaded=loadDrafts(storage);assert.equal(loaded[0].title,'Private new version');assert.equal(editingPosts(site,loaded)[0].status,'draft');assert.notEqual(site.posts[0].title,'Private new version');});
test('credential only goes to fixed GitHub API headers, never to URLs or repository payloads',async()=>{const server=new FakeGitHub(),repo=client(server);await repo.publishPost(newPost());for(const request of server.requests){assert.equal(new URL(request.url).origin,'https://api.github.com');assert.ok(!request.url.includes('dummy-token'));assert.ok(!JSON.stringify(request.body||{}).includes('dummy-token'));}assert.ok(!JSON.stringify(server.site()).includes('dummy-token'));repo.disconnect();await assert.rejects(repo.read(),/重新连接/);});
test('invalid token produces a useful error without exposing the credential',async()=>{const server=new FakeGitHub();server.tokenInvalid=true;await assert.rejects(client(server).connect(),error=>error.status===401&&!error.message.includes('dummy-token'));});
test('invalid region/color and duplicate article IDs are rejected before saving',()=>{const site=initial();assert.throws(()=>validateContent({...site,colors:{'cn-33':'url(javascript:bad)'}}));assert.throws(()=>validateContent({...site,visits:{bad:'visited'}}));assert.throws(()=>validateContent({...site,posts:[...site.posts,site.posts[0]]}));assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));});
