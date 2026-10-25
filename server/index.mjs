import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RoomStore} from './store.mjs';
import {createRoomServer} from './http.mjs';
// Reuse the repository's full-data gate; never silently start with fallback data.
import '../scripts/validate-world-data.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const rows=JSON.parse(readFileSync(resolve(root,'data/world-places.json'),'utf8'));
const places=new Map(rows.map(r=>[String(r[0]),{id:String(r[0]),name:r[1],lat:r[2],lon:r[3],countryCode:r[4],country:r[4],region:r[6]}]));
const dbPath=resolve(process.env.ORTEN_DB_PATH||'server/var/rooms.sqlite');mkdirSync(dirname(dbPath),{recursive:true});
const store=new RoomStore(dbPath,{resolvePlace:id=>places.get(id)});
const server=createRoomServer(store,{root});
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Orten server ready on port',server.address().port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>{store.close();process.exit(0)});server.closeIdleConnections()});
