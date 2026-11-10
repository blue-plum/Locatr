import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { importInventory } from './inventory-import.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const data=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
mkdirSync(path.join(data,'photos'),{recursive:true});
const db=new DatabaseSync(path.join(data,'storage.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS locations(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS types(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS storage(id TEXT PRIMARY KEY,name TEXT NOT NULL,location_id INTEGER NOT NULL REFERENCES locations(id),type_id INTEGER NOT NULL REFERENCES types(id),position TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',photo TEXT);
CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,storage_id TEXT NOT NULL REFERENCES storage(id),name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',keywords TEXT NOT NULL DEFAULT '',quantity INTEGER NOT NULL DEFAULT 1,photo TEXT);`);
db.exec('CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
if(!db.prepare("SELECT value FROM settings WHERE key='lists_initialized'").get()){
 for(const [table,names] of [['locations',['Bedroom','Kitchen','Office','Loft','Shed']],['types',['Drawer','Box','Box size A','Box size B','Cupboard','Cabinet']]]) for(const name of names) db.prepare(`INSERT OR IGNORE INTO ${table}(name) VALUES (?)`).run(name);
 db.prepare("INSERT INTO settings VALUES('lists_initialized','1')").run();
}
const app=express();
app.disable('x-powered-by');
app.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Please submit from this site.'});next();});
app.post('/api/import',express.json({limit:'16mb'}),(req,res)=>{
 if(req.headers['x-locatr-confirm']!=='replace-records')return res.status(400).json({error:'Confirm replacement before importing.'});
 res.json({ok:true,...importInventory(db,req.body)});
});
app.use(express.json({limit:'64kb'}));
app.use('/photos',express.static(path.join(data,'photos'),{dotfiles:'deny'}));
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1}}).single('photo');
const text=(v,max=2000)=>String(v??'').trim().slice(0,max);
function required(v){const s=text(v,120);if(!s)throw new Error('A name is required.');return s;}
async function photo(req){if(!req.file)return undefined;const name=randomUUID()+'.jpg';await sharp(req.file.buffer).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toFile(path.join(data,'photos',name));return '/photos/'+name;}
app.get('/api/state',(req,res)=>res.json({locations:db.prepare('SELECT * FROM locations ORDER BY name').all(),types:db.prepare('SELECT * FROM types ORDER BY name').all(),storage:db.prepare('SELECT * FROM storage ORDER BY name').all(),items:db.prepare('SELECT * FROM items ORDER BY name').all()}));
app.post('/api/:list',(req,res,next)=>{if(!['locations','types'].includes(req.params.list))return next();const name=required(req.body.name);db.prepare(`INSERT INTO ${req.params.list}(name) VALUES (?)`).run(name);res.json({ok:true});});
app.delete('/api/:list/:id',(req,res,next)=>{
 const table=req.params.list;
 if(!['locations','types'].includes(table))return next();
 const id=Number(req.params.id),column=table==='locations'?'location_id':'type_id';
 if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid list entry.'});
 if(!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id))return res.status(404).json({error:'List entry not found.'});
 if(db.prepare(`SELECT count(*) n FROM storage WHERE ${column}=?`).get(id).n)return res.status(409).json({error:'This '+(table==='locations'?'location':'storage type')+' is still in use. Edit the affected storage to choose another one first.'});
 db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
 res.json({ok:true});
});
app.post('/api/storage',upload,async(req,res)=>{const b=req.body,id=randomUUID(),p=await photo(req);db.prepare('INSERT INTO storage VALUES(?,?,?,?,?,?,?)').run(id,required(b.name),Number(b.location_id),Number(b.type_id),text(b.position,200),text(b.notes),p||null);res.json({id});});
app.put('/api/storage/:id',upload,async(req,res)=>{const b=req.body,p=await photo(req);const r=db.prepare('UPDATE storage SET name=?,location_id=?,type_id=?,position=?,notes=?,photo=COALESCE(?,photo) WHERE id=?').run(required(b.name),Number(b.location_id),Number(b.type_id),text(b.position,200),text(b.notes),p||null,req.params.id);if(!r.changes)return res.status(404).json({error:'Storage not found'});res.json({ok:true});});
app.post('/api/items',upload,async(req,res)=>{const b=req.body,p=await photo(req),id=randomUUID();const q=Number(b.quantity||1);if(!Number.isInteger(q)||q<1||q>100000)throw new Error('Quantity must be between 1 and 100000.');db.prepare('INSERT INTO items VALUES(?,?,?,?,?,?,?)').run(id,b.storage_id,required(b.name),text(b.description),text(b.keywords,500),q,p||null);res.json({id});});
app.put('/api/items/:id',upload,async(req,res)=>{const b=req.body,p=await photo(req),q=Number(b.quantity||1);if(!Number.isInteger(q)||q<1||q>100000)throw new Error('Invalid quantity');const r=db.prepare('UPDATE items SET storage_id=?,name=?,description=?,keywords=?,quantity=?,photo=COALESCE(?,photo) WHERE id=?').run(b.storage_id,required(b.name),text(b.description),text(b.keywords,500),q,p||null,req.params.id);if(!r.changes)return res.status(404).json({error:'Item not found'});res.json({ok:true});});
app.delete('/api/items/:id',(req,res)=>{db.prepare('DELETE FROM items WHERE id=?').run(req.params.id);res.json({ok:true});});
app.delete('/api/storage/:id',(req,res)=>{if(db.prepare('SELECT count(*) n FROM items WHERE storage_id=?').get(req.params.id).n)return res.status(409).json({error:'Move or remove the items first.'});db.prepare('DELETE FROM storage WHERE id=?').run(req.params.id);res.json({ok:true});});
app.get('/api/qr/:id',async(req,res)=>{if(!db.prepare('SELECT id FROM storage WHERE id=?').get(req.params.id))return res.sendStatus(404);const base=process.env.PUBLIC_URL||`${req.protocol}://${req.headers.host}`;res.type('png').send(await QRCode.toBuffer(`${base.replace(/\/$/,'')}/?storage=${req.params.id}`,{width:360,margin:2,errorCorrectionLevel:'M'}));});
app.get('/api/label/:id',async(req,res)=>{
 const storage=db.prepare('SELECT * FROM storage WHERE id=?').get(req.params.id);
 if(!storage)return res.status(404).json({error:'Storage not found.'});
 const base=process.env.PUBLIC_URL||`${req.protocol}://${req.headers.host}`;
 const qr=QRCode.create(`${base.replace(/\/$/,'')}/?storage=${storage.id}`,{errorCorrectionLevel:'M'});
 const n=qr.modules.size,unit=32/(n+8),xml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const lines=[req.query.title??storage.name,req.query.subtitle??'',req.query.detail??''].map(v=>text(v,40));
 let modules='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.modules.get(y,x))modules+=`<rect x="${4+(x+4)*unit}" y="${4+(y+4)*unit}" width="${unit}" height="${unit}"/>`;
 const lettering=lines.map((line,i)=>`<text x="40" y="${15+i*7}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${Math.min(i===0?4.5:3.5,88/Math.max(1,line.length))}" ${i===0?'font-weight="bold"':''}>${xml(line)}</text>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="40mm" viewBox="0 0 100 40"><rect width="100" height="40" fill="white"/><g fill="black">${modules}${lettering}</g></svg>`;
 const png=req.query.format==='png';if(req.query.download==='1')res.attachment(`Locatr-${storage.id.slice(0,8)}.${png?'png':'svg'}`);
 res.type(png?'png':'svg').send(png?await sharp(Buffer.from(svg),{density:300}).png().toBuffer():svg);
});
app.get('/api/export',(req,res)=>{res.attachment('storage-tracker.json').json({exported:new Date().toISOString(),locations:db.prepare('SELECT * FROM locations').all(),types:db.prepare('SELECT * FROM types').all(),storage:db.prepare('SELECT * FROM storage').all(),items:db.prepare('SELECT * FROM items').all()});});
app.use(express.static(path.join(root,'public')));
app.use((err,req,res,next)=>{console.error(err.message);res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Photo too large. Maximum 15 MB.':/UNIQUE/.test(err.message)?'That name already exists.':/FOREIGN KEY/.test(err.message)?'Choose an existing location, type or storage.':err.message||'Unable to save.'});});
const server=app.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Storage Tracker listening on port '+(process.env.PORT||8080)));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
