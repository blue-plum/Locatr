import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

test('storage, photos, QR codes, moves, validation and persistence',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'storage-test-')),port=18193,base=`http://127.0.0.1:${port}`;
 let child;
 async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,DATA_DIR:dir,PORT:String(port)},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);child.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(timer);resolve();}});child.on('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});});}
 async function stop(){await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
 async function request(url,method='GET',body){const r=await fetch(base+url,{method,body});return {r,b:await r.json()};}
 function form(values){const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,String(v));return f;}
 try{await start();const initial=(await request('/api/state')).b;assert.equal(initial.storage.length,0);const values={name:'Loft winter box',location_id:initial.locations[0].id,type_id:initial.types[0].id,position:'Top shelf'};
 const create=await request('/api/storage','POST',form(values));assert.equal(create.r.status,200);const id=create.b.id;
 for(const [list,used] of [['locations',values.location_id],['types',values.type_id]]){
  assert.equal((await request(`/api/${list}/${used}`,'DELETE')).r.status,409);
  const unused=initial[list].find(x=>x.id!==used);
  assert.equal((await request(`/api/${list}/${unused.id}`,'DELETE')).r.status,200);
  assert.equal((await request(`/api/${list}/${unused.id}`,'DELETE')).r.status,404);
 }
 const qr=await fetch(base+'/api/qr/'+id);assert.equal(qr.headers.get('content-type'),'image/png');assert.deepEqual([...new Uint8Array(await qr.arrayBuffer()).slice(0,4)],[137,80,78,71]);
 const label=await fetch(base+'/api/label/'+id+'?title=%3Ctest%3E&subtitle=Loft&download=1');assert.equal(label.status,200);assert.match(label.headers.get('content-disposition'),/attachment/);const svg=await label.text();assert.match(svg,/width="100mm"/);assert.match(svg,/&lt;test&gt;/);assert.match(svg,/>Loft<\/text>/);
 const png=await fetch(base+'/api/label/'+id+'?format=png');assert.equal(png.headers.get('content-type'),'image/png');const meta=await sharp(Buffer.from(await png.arrayBuffer())).metadata();assert.ok(meta.width>1100);assert.equal((await fetch(base+'/api/label/missing')).status,404);
 const item=form({name:'Winter coat',storage_id:id,description:'Blue coat',keywords:'winter warm',quantity:2});item.set('photo',new Blob([await sharp({create:{width:10,height:10,channels:3,background:'#abc'}}).png().toBuffer()],{type:'image/png'}),'coat.png');
 const add=await request('/api/items','POST',item);assert.equal(add.r.status,200,JSON.stringify(add.b));let state=(await request('/api/state')).b;assert.equal(state.items[0].quantity,2);assert.ok(state.items[0].photo);assert.equal((await fetch(base+state.items[0].photo)).status,200);
 assert.equal((await request('/api/storage/'+id,'DELETE')).r.status,409);
 const second=(await request('/api/storage','POST',form({...values,name:'Other box'}))).b.id;
 assert.equal((await request('/api/items/'+add.b.id,'PUT',form({name:'Winter coat',storage_id:second,keywords:'winter',quantity:1}))).r.status,200);
 assert.equal((await request('/api/items','POST',form({name:'Bad',storage_id:'missing',quantity:1}))).r.status,400);
 assert.equal((await request('/api/items','POST',form({name:'Bad',storage_id:id,quantity:0}))).r.status,400);
 const denied=await fetch(base+'/api/locations',{method:'POST',headers:{Origin:'http://other.invalid','Content-Type':'application/json'},body:JSON.stringify({name:'Attack'})});assert.equal(denied.status,403);
 await stop();await start();state=(await request('/api/state')).b;assert.equal(state.items[0].storage_id,second);assert.ok(state.items[0].photo);
 assert.equal(state.locations.length,initial.locations.length-1);assert.equal(state.types.length,initial.types.length-1);
 assert.equal((await request('/api/storage/'+id,'DELETE')).r.status,200);assert.equal((await request('/api/items/'+add.b.id,'DELETE')).r.status,200);assert.equal((await request('/api/storage/'+second,'DELETE')).r.status,200);
 const exportData=(await request('/api/export')).b;assert.equal(exportData.items.length,0);
 const restore=payload=>fetch(base+'/api/import',{method:'POST',headers:{'Content-Type':'application/json','X-Locatr-Confirm':'replace-records'},body:JSON.stringify(payload)});
 assert.equal((await restore(state)).status,200);assert.deepEqual((await request('/api/state')).b,state);
 const broken=structuredClone(state);broken.items[0].storage_id='missing';assert.equal((await restore(broken)).status,400);assert.deepEqual((await request('/api/state')).b,state);
 const duplicate=structuredClone(state);duplicate.locations.push(duplicate.locations[0]);assert.equal((await restore(duplicate)).status,400);assert.deepEqual((await request('/api/state')).b,state);
 const invalid=structuredClone(state);invalid.storage[0].photo='/photos/../../private';assert.equal((await restore(invalid)).status,400);
 assert.equal((await fetch(base+'/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(initial)})).status,400);
 await stop();await start();assert.deepEqual((await request('/api/state')).b,state);
 }finally{if(child&&child.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});

