import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
export function createRoomServer(store,{root}={}){
  const rates=new Map();
  return createServer(async(req,res)=>{
    const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
    try{
      const url=new URL(req.url,'http://localhost'),path=url.pathname;
      if(path==='/healthz')return json(200,{ok:true});
      if(path.startsWith('/api/')){
        // Same-origin only. A native client may omit Origin, but must still hold its bearer token.
        if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'Fel ursprung.'});
        const ip=req.socket.remoteAddress,now=Date.now();
        if(rates.size>10000)for(const [key,v] of rates)if(now-v.at>60000)rates.delete(key);
        let rate=rates.get(ip);if(!rate||now-rate.at>60000){rate={at:now,count:0,creates:0};rates.set(ip,rate)}
        if(++rate.count>600)return json(429,{error:'För många anrop. Vänta en stund.'});
        let body={};
        if(req.method==='POST'){
          if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'JSON krävs.'});
          let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return json(413,{error:'För stort anrop.'})}
          try{body=JSON.parse(raw||'{}')}catch{return json(400,{error:'Ogiltig JSON.'})}
          if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'Ogiltigt anrop.'});
        }
        if(path==='/api/rooms'&&req.method==='POST'){
          if(++rate.creates>20)return json(429,{error:'För många nya rum. Vänta en minut.'});
          return json(201,store.create(body));
        }
        const m=path.match(/^\/api\/rooms\/([A-Z0-9]{5,6})\/(join|state|settings|start|move)$/);
        if(!m||req.method!==(m[2]==='state'?'GET':'POST'))return json(404,{error:'Okänd adress.'});
        if(m[2]==='join')return json(200,store.join(m[1],body));
        const token=(req.headers.authorization||'').replace(/^Bearer /,'');
        return json(200,store.request(m[1],token,m[2],body));
      }
      if(req.method!=='GET'||!root){res.writeHead(404);return res.end()}
      if(path==='/v3/server-config.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end('globalThis.ORTEN_SERVER_URL="/api";')}
      const file=path==='/'?'/index.html':path;
      if(!/^\/(index\.html|v3\/(?:src\/[\w-]+\.js|[\w-]+\.(?:html|css|js))|data\/world-(?:places|manifest)\.json|assets\/[\w.-]+)$/.test(file)){res.writeHead(404);return res.end()}
      const content=await readFile(resolve(root,'.'+file));
      const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(content);
    }catch(error){json(error.status|| (error.code==='ENOENT'?404:500),{error:error.status?error.message:'Servern kunde inte hantera anropet.'})}
  });
}
