// Rebuild offline SVG geometry from the pinned Natural Earth GeoJSON files.
// Usage: node generate-maps.mjs <admin-1.geojson> <countries.geojson>
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [adminFile,countryFile]=process.argv.slice(2);
if(!adminFile||!countryFile)throw Error('Pass the Natural Earth admin-1 and countries GeoJSON paths. See MAP_SOURCES.md.');
const adminBytes=readFileSync(adminFile),countryBytes=readFileSync(countryFile);
const admin=JSON.parse(adminBytes).features,countries=JSON.parse(countryBytes).features;
const isoToCode={XJ:'65',XZ:'54',QH:'63',GS:'62',NM:'15',NX:'64',HL:'23',JL:'22',LN:'21',HE:'13',BJ:'11',TJ:'12',SX:'14',SN:'61',SD:'37',HA:'41',JS:'32',AH:'34',SH:'31',HB:'42',SC:'51',CQ:'50',ZJ:'33',JX:'36',HN:'43',FJ:'35',GZ:'52',YN:'53',GX:'45',GD:'44',HI:'46'};
const polygons=g=>g.type==='Polygon'?[g.coordinates]:g.coordinates;
const selected=[];
for(const f of admin){const p=f.properties,iso=p.iso_3166_2;if(p.adm0_a3==='CHN'&&isoToCode[iso.slice(3)])selected.push({id:'cn-'+isoToCode[iso.slice(3)],polygons:polygons(f.geometry),label:[p.longitude,p.latitude]});if(p.adm0_a3==='JPN')selected.push({id:'jp-'+iso.slice(3),polygons:polygons(f.geometry),label:[p.longitude,p.latitude]});}
for(const [code,id] of [['HKG','81'],['MAC','82'],['TWN','71']]){const f=countries.find(x=>x.properties.ADM0_A3===code);selected.push({id:'cn-'+id,polygons:polygons(f.geometry),label:[f.properties.LABEL_X,f.properties.LABEL_Y]});}
// Natural Earth's Okinawa feature contains the Amami islands. Assign those
// complete island polygons to Kagoshima (27°N and north), preserving geometry.
const okinawa=selected.find(r=>r.id==='jp-47'),kagoshima=selected.find(r=>r.id==='jp-46');
const amami=okinawa.polygons.filter(p=>Math.min(...p[0].map(v=>v[1]))>=27);
okinawa.polygons=okinawa.polygons.filter(p=>!amami.includes(p));kagoshima.polygons.push(...amami);kagoshima.label=[130.6,31.6];okinawa.label=[127.9,26.5];
const rad=d=>d*Math.PI/180,phi1=rad(25),phi2=rad(47),t=p=>Math.tan(Math.PI/4+p/2);
const n=Math.log(Math.cos(phi1)/Math.cos(phi2))/Math.log(t(phi2)/t(phi1)),F=Math.cos(phi1)*t(phi1)**n/n;
const china=([lon,lat])=>{const rho=F/t(rad(lat))**n,theta=n*rad(lon-105);return [rho*Math.sin(theta),rho*Math.cos(theta)];};
const japan=([lon,lat])=>[rad(lon),-Math.log(t(rad(lat)))];
const bounds=pts=>{const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];};
const fit=(raw,box)=>{const [x0,y0,x1,y1]=bounds(raw),[left,top,width,height]=box,scale=Math.min(width/(x1-x0),height/(y1-y0));return p=>[left+(width-(x1-x0)*scale)/2+(p[0]-x0)*scale,top+(height-(y1-y0)*scale)/2+(p[1]-y0)*scale];};
const points=polys=>polys.flatMap(p=>p[0]);
const mainJapan=p=>p[0].every(([lon,lat])=>lon<147&&lat>=29);
const byCountry=country=>selected.filter(r=>r.id.startsWith(country+'-'));
const cnFit=fit(byCountry('cn').flatMap(r=>points(r.polygons)).map(china),[18,18,684,488]);
const jpFit=fit(byCountry('jp').filter(r=>r.id!=='jp-47').flatMap(r=>points(r.polygons.filter(mainJapan))).map(japan),[28,20,664,504]);
const okFit=fit(points(okinawa.polygons).map(japan),[42,92,180,106]);
const project=(id,p)=>id.startsWith('cn-')?cnFit(china(p)):id==='jp-47'?okFit(japan(p)):jpFit(japan(p));
const round=v=>Math.round(v*4)/4;
function cleanRing(ring){const q=[];for(const p of ring){const v=p.map(round);if(!q.length||v[0]!==q.at(-1)[0]||v[1]!==q.at(-1)[1])q.push(v);}if(q.length>1&&q[0][0]===q.at(-1)[0]&&q[0][1]===q.at(-1)[1])q.pop();if(q.length<3)return [];
  // Removing only collinear points keeps shared province borders identical.
  return q.filter((b,i)=>{const a=q[(i+q.length-1)%q.length],c=q[(i+1)%q.length];return (b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0]);});}
function pathFor(polys,projection){return polys.map(p=>p.map(r=>cleanRing(r.map(projection))).filter(r=>r.length>=3).map(r=>'M'+r.map(p=>p.join(',')).join('L')+'Z').join('')).join('');}
const result={};
for(const r of selected){const polys=r.id.startsWith('jp-')&&r.id!=='jp-47'?r.polygons.filter(mainJapan):r.polygons,projectPoint=p=>project(r.id,p),coordinates=points(polys).map(projectPoint),[x0,y0,x1,y1]=bounds(coordinates);let path=pathFor(polys,projectPoint),label=projectPoint(r.label);const miniPath=path;
  if(r.id==='cn-81'||r.id==='cn-82'){const box=r.id==='cn-81'?[36,438,78,50]:[153,438,52,50],magnify=fit(coordinates,box);path+=pathFor(polys,p=>magnify(projectPoint(p)));label=r.id==='cn-81'?[75,505]:[179,505];}
  result[r.id]={path,miniPath,bounds:[round(x0-4),round(y0-4),round(x1-x0+8),round(y1-y0+8)],x:round(label[0]),y:round(label[1]),anchor:projectPoint(r.label).map(round)};
}
// Outside labels in dense coastal areas, with leader lines to the actual region.
const offsets={'cn-11':[36,-14],'cn-12':[47,4],'cn-31':[34,5],'jp-13':[48,4],'jp-14':[39,21],'jp-11':[37,-12],'jp-12':[48,24],'jp-25':[0,-21],'jp-27':[-20,12],'jp-29':[9,19],'jp-37':[0,-15],'jp-41':[-24,-12]};
for(const [id,[dx,dy]] of Object.entries(offsets)){const r=result[id];r.x+=dx;r.y+=dy;r.leader=true;}
// Place every Japanese label without overlap; short leaders keep dense Kansai
// and Kanto labels associated with the underlying prefecture after zooming.
const placed=[],longNames=new Set(['jp-01','jp-14','jp-30','jp-46']);
for(const id of Object.keys(result).filter(id=>id.startsWith('jp-')).sort()){
  const r=result[id],width=longNames.has(id)?38:26,candidates=[];
  for(let dy=-60;dy<=60;dy+=4)for(let dx=-60;dx<=60;dx+=4)candidates.push({x:r.x+dx,y:r.y+dy,cost:dx*dx+dy*dy});
  candidates.sort((a,b)=>a.cost-b.cost);
  const chosen=candidates.find(p=>p.x>width/2+8&&p.x<712-width/2&&p.y>15&&p.y<535&&!placed.some(b=>Math.abs(p.x-b.x)<(width+b.width)/2+3&&Math.abs(p.y-b.y)<16));
  if(!chosen)throw Error('Could not place map label '+id);
  if(Math.hypot(chosen.x-r.anchor[0],chosen.y-r.anchor[1])>9)r.leader=true;
  r.x=chosen.x;r.y=chosen.y;placed.push({...chosen,width});
}
const source={name:'Natural Earth',release:'source snapshot 2026-10-21',license:'Public domain',repository:'https://github.com/nvkelso/natural-earth-vector',commit:'ca96624a56bd078437bca8184e78163e5039ad19',adminSHA256:createHash('sha256').update(adminBytes).digest('hex'),countriesSHA256:createHash('sha256').update(countryBytes).digest('hex')};
const output=new URL(existsSync(new URL('dist/',import.meta.url))?'dist/geography.js':'geography.js',import.meta.url);
writeFileSync(output,'// Generated by generate-maps.mjs. Natural Earth public-domain geographic outlines.\nexport const MAP_SOURCE='+JSON.stringify(source)+';\nexport const MAP_VIEWBOX={cn:"0 0 720 540",jp:"0 0 720 550"};\nexport const REGION_GEOMETRY='+JSON.stringify(result)+';\n');
console.log('Generated real geographic outlines for',Object.keys(result).length,'regions;',Buffer.byteLength(JSON.stringify(result)),'bytes.');
