export function importInventory(db, body){
 const tables={locations:['id','name'],types:['id','name'],storage:['id','name','location_id','type_id','position','notes','photo'],items:['id','storage_id','name','description','keywords','quantity','photo']};
 if(!body||Object.keys(tables).some(t=>!Array.isArray(body[t])||body[t].length>100000))throw Error('Choose a valid Locatr JSON export.');
 const integer=v=>Number.isSafeInteger(v)&&v>0;
 for(const [table,fields] of Object.entries(tables))for(const row of body[table]){
  if(!row||fields.some(k=>!(k in row)))throw Error('Missing fields in '+table+'.');
  if(['locations','types'].includes(table)?!integer(row.id):typeof row.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(row.id))throw Error('Invalid record ID.');
  if(typeof row.name!=='string'||!row.name.trim()||row.name.length>120)throw Error('Invalid record name.');
  if(table==='storage'&&(!integer(row.location_id)||!integer(row.type_id)))throw Error('Invalid location or type ID.');
  if(table==='items'&&(!integer(row.quantity)||row.quantity>100000||typeof row.storage_id!=='string'))throw Error('Invalid item storage or quantity.');
  for(const key of ['position','notes','description','keywords'])if(key in row&&(typeof row[key]!=='string'||row[key].length>2000))throw Error('Invalid '+key+'.');
  if('photo' in row&&row.photo!==null&&(typeof row.photo!=='string'||!/^\/photos\/[a-zA-Z0-9-]+\.jpg$/.test(row.photo)))throw Error('Invalid photo reference.');
 }
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec('DELETE FROM items; DELETE FROM storage; DELETE FROM locations; DELETE FROM types;');
  for(const [table,fields]of Object.entries(tables)){const insert=db.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`);for(const row of body[table])insert.run(...fields.map(k=>row[k]));}
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw Error('Import failed. Check for duplicate IDs, names or missing references. Current records have been kept.');}
 return {storage:body.storage.length,items:body.items.length};
}
