import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {createGame,playPlace} from '../v3/src/engine.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const name=s=>{if(typeof s!=='string'||!s.trim()||s.length>24)fail('Skriv ett namn på 1–24 tecken.');return s.trim()};
const countries=value=>{if(!Array.isArray(value)||value.length>249||value.some(c=>typeof c!=='string'||!/^[A-Z]{2}$/.test(c)))fail('Ogiltigt landsval.');return [...new Set(value)]};
const mode=value=>{if(!['classic','duel'].includes(value))fail('Ogiltigt spelläge.');return value};
export class RoomStore {
  constructor(path,{resolvePlace,now=Date.now,ttl=7*86400000}={}){
    this.resolvePlace=resolvePlace;this.now=now;this.ttl=ttl;
    this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, body TEXT NOT NULL, updated INTEGER NOT NULL)');
  }
  close(){this.db.close()}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result}catch(e){this.db.exec('ROLLBACK');throw e}}
  save(room){this.db.prepare('INSERT OR REPLACE INTO rooms VALUES(?,?,?)').run(room.code,JSON.stringify(room),this.now())}
  read(code){const row=this.db.prepare('SELECT body,updated FROM rooms WHERE code=?').get(code);if(!row||row.updated<this.now()-this.ttl)fail('Rummet finns inte eller har gått ut.',404);return JSON.parse(row.body)}
  player(room,token){if(typeof token!=='string'||token.length!==64)fail('Återanslutningsnyckel saknas.',401);const p=room.players.find(p=>p.secret===hash(token));if(!p)fail('Fel återanslutningsnyckel.',401);return p}
  view(room,p){return {roomCode:room.code,role:p.id==='host'?'host':'guest',playerId:p.id,name:p.name,mode:room.mode,countries:room.countries,players:room.players.map(({id,name,lastSeen})=>({id,name,connected:this.now()-lastSeen<15000})),started:!!room.state,state:room.state,revision:room.revision}}
  create(input){return this.transaction(()=>{
    this.db.prepare('DELETE FROM rooms WHERE updated < ?').run(this.now()-this.ttl);
    if(this.db.prepare('SELECT count(*) AS n FROM rooms').get().n>=10000)fail('Servern är full. Försök senare.',503);
    const code=String(input.code||'').toUpperCase();if(!/^[A-Z0-9]{5,6}$/.test(code))fail('Rumskoden ska ha 5–6 bokstäver eller siffror.');
    if(this.db.prepare('SELECT 1 FROM rooms WHERE code=?').get(code))fail('Rumskoden används redan.',409);
    const token=randomBytes(32).toString('hex');const p={id:'host',name:name(input.name),secret:hash(token),lastSeen:this.now()};
    const room={code,players:[p],mode:mode(input.mode||'classic'),countries:countries(input.countries||[]),state:null,revision:-1,moves:{}};
    this.save(room);return {...this.view(room,p),token};
  })}
  join(code,input){return this.transaction(()=>{
    const room=this.read(code);if(room.state||room.players.length>=2)fail('Rummet är fullt eller matchen har startat.',409);
    const token=randomBytes(32).toString('hex'),p={id:randomBytes(16).toString('hex'),name:name(input.name),secret:hash(token),lastSeen:this.now()};room.players.push(p);this.save(room);return {...this.view(room,p),token};
  })}
  request(code,token,action,input={}){return this.transaction(()=>{
    const room=this.read(code),p=this.player(room,token);p.lastSeen=this.now();
    if(action==='settings'){
      if(p.id!=='host'||room.state)fail('Inställningarna kan inte ändras.',403);
      if(input.mode!==undefined)room.mode=mode(input.mode);
      if(input.countries!==undefined)room.countries=countries(input.countries);
    }else if(action==='start'){
      if(p.id!=='host')fail('Bara värden kan starta.',403);
      if(!room.state){if(room.players.length!==2||room.players.some(p=>this.now()-p.lastSeen>=15000))fail('Två anslutna spelare krävs.');room.state=createGame({mode:room.mode,players:room.players.map(p=>p.name),playerIds:room.players.map(p=>p.id),allowedCountries:room.countries});room.revision=0}
    }else if(action==='move'){
      const id=input.moveId;if(typeof id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(id))fail('Ogiltigt drag-id.');
      const key=`${p.id}:${id}`,previous=room.moves[key];
      if(previous){if(previous.placeId!==String(input.placeId))fail('Drag-id har redan använts för en annan ort.',409)}
      else {
        if(!room.state||room.state.status!=='playing')fail('Matchen är inte aktiv.');
        if(input.revision!==room.revision)fail('Matchen har uppdaterats. Försök igen.',409);
        if(room.state.players[room.state.turn].onlineId!==p.id)fail('Det är inte din tur.',403);
        if(room.state.places.length>=5000)fail('Matchen har nått gränsen på 5 000 drag.');
        const place=this.resolvePlace(String(input.placeId));if(!place)fail('Orten finns inte i serverns register.');
        try{room.state=playPlace(room.state,place)}catch(error){fail(error.message)}room.revision++;room.moves[key]={placeId:String(input.placeId)};
      }
    }else if(action!=='state')fail('Okänd åtgärd.',404);
    this.save(room);return {...this.view(room,p),ackMoveId:action==='move'?input.moveId:null};
  })}
}
