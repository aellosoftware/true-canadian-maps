import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base=process.env.TEST_BASE??'http://127.0.0.1:16060';
assert.ok(/^http:\/\/127\.0\.0\.1:1606[02]$/.test(base));
const stateFile=process.env.TEST_EVIDENCE;
assert.ok(stateFile, 'TEST_EVIDENCE must name a disposable evidence file');
let cookie='';
async function request(path,body) {
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',origin:base,cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.ok(r.ok,`HTTP ${r.status} for ${path}`);
  const cookies=r.headers.getSetCookie(); if(cookies.length)cookie=cookies.map(c=>c.split(';')[0]).join('; ');
  return r.json();
}
if(process.argv[2]==='create'){
  await request('/api/auth/sign-in/email',{email:'admin@example.test',password:'Disposable-map-test-2026!'});
  const me=await request('/api/v1/me');
  const org=me.organizations[0].organizationId;
  const {project}=await request(`/api/v1/orgs/${org}/projects`,{name:'Restore acceptance map',presetSlug:'true-north'});
  const path=`/api/v1/orgs/${org}/projects/${project.id}`;
  await request(path+'/markers',{title:'Ottawa city centre',lng:-75.6972,lat:45.4215});
  const {release}=await request(path+'/publish',{});
  let published;
  for(let i=0;i<60;i++){
    const result=await request(path+'/releases/'+release.id);
    assert.notEqual(result.release.status,'failed');
    if(result.release.status==='published'){published=result.release;break;}
    await new Promise(r=>setTimeout(r,1000));
  }
  assert.ok(published);
  const {key}=await request(path+'/keys',{label:'Restore test website',allowedOrigins:['https://embed.example.test']});
  writeFileSync(stateFile,JSON.stringify({projectId:project.id,publicKey:key.publicKey,releaseId:release.id,hashes:null}),{mode:0o600});
}
const state=JSON.parse(readFileSync(stateFile));
const response=await fetch(base+`/api/v1/embed/config?project=${state.projectId}&env=production&key=${state.publicKey}`,{headers:{origin:'https://embed.example.test'}});
assert.equal(response.status,200);
const config=await response.json(); assert.equal(config.releaseId,state.releaseId);
const hashes={};
for(const [name,url] of Object.entries({style:config.styleUrl,markers:config.markersUrl,manifest:config.manifestUrl,sprite:config.spriteUrl+'.png'})){
  assert.equal(new URL(url).hostname,'127.0.0.1');
  const r=await fetch(url); assert.equal(r.status,200);
  const bytes=Buffer.from(await r.arrayBuffer()); hashes[name]=createHash('sha256').update(bytes).digest('hex');
  if(name==='markers')assert.equal(JSON.parse(bytes).features[0].properties.title,'Ottawa city centre');
}
if(state.hashes)assert.deepEqual(hashes,state.hashes);
else {state.hashes=hashes;writeFileSync(stateFile,JSON.stringify(state),{mode:0o600});}
console.log('Published map, cross-origin discovery and all immutable artifact hashes passed.');
