// Same interface as the PeerJS controller; the server owns rules and persistence.
export function createServerOnlineController(callbacks={},options={}){
  const base=(options.base||globalThis.ORTEN_SERVER_URL).replace(/\/$/,'');
  const fetcher=options.fetch||globalThis.fetch.bind(globalThis);
  const storage=options.storage||(()=>{try{return globalThis.localStorage}catch{return null}})();
  const interval=options.interval??1000,key=`orten3:server-session:${base}`;
  const cb={onStatus:()=>{},onLobby:()=>{},onState:()=>{},onError:()=>{},...callbacks};
  let session=null,state=null,revision=-2,status='idle',timer=null,epoch=0,busy=false,pending=null;
  let queue=Promise.resolve(),sessionSnapshot=null;
  const saved=()=>{try{return JSON.parse(storage?.getItem(key)||'null')}catch{return null}};
  const persist=()=>{if(!storage)throw new Error('Tillåt lokal lagring för att kunna återansluta till matchen.');storage.setItem(key,JSON.stringify({...session,pending}))};
  const snapshot=()=>({...sessionSnapshot,role:sessionSnapshot?.role||'offline',status,roomCode:session?.roomCode||'',playerId:sessionSnapshot?.playerId||'',players:sessionSnapshot?.players||[],countries:sessionSnapshot?.countries||[],started:!!state,revision,serverRevision:revision,pending:!!pending,sessionId:'server',connectionId:'https',reconnectAttempt:status==='reconnecting'?1:0,maxReconnectAttempts:Infinity});
  const emit=()=>{cb.onStatus(snapshot());cb.onLobby(snapshot())};
  function accept(data){
    // GET and POST can cross in transit. Never regress state.
    if(data.revision<revision)return;
    const {token,...publicData}=data;sessionSnapshot=publicData;status='connected';
    if(data.state&&data.revision!==revision){revision=data.revision;state=data.state;cb.onState({state:structuredClone(state),role:data.role,playerId:data.playerId,revision,ackMoveId:data.ackMoveId})}
    emit();
  }
  async function request(path,body,token=session?.token){
    const response=await fetcher(`${base}${path}`,{method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(10000)});
    const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Serverfel.'),{status:response.status});return data;
  }
  function report(error){status='reconnecting';emit();cb.onError(error)}
  function stop(){epoch++;clearTimeout(timer);timer=null;busy=false}
  function schedule(){clearTimeout(timer);if(session)timer=setTimeout(()=>void cycle(),interval)}
  async function cycle(){
    if(!session||busy)return;const generation=epoch;busy=true;
    try{
      if(pending){
        const move=pending;
        try{const data=await request(`/rooms/${session.roomCode}/move`,move);if(generation!==epoch)return;pending=null;persist();accept(data)}
        catch(error){if(generation!==epoch)return;if(error.status&&error.status<500&&error.status!==429){pending=null;persist();cb.onError(error)}else throw error}
      }
      const data=await request(`/rooms/${session.roomCode}/state`);if(generation!==epoch)return;accept(data);
    }catch(error){if(generation===epoch){report(error);if(error.status===401||error.status===404){stop();session=null;storage?.removeItem(key);status='error';emit();return}}}
    finally{if(generation===epoch){busy=false;schedule()}}
  }
  function checkStorage(){if(!storage)throw new Error('Lokal lagring behövs för återanslutning.');storage.setItem(key+':check','1');storage.removeItem(key+':check')}
  async function enter(path,input){
    checkStorage();stop();session=null;state=null;sessionSnapshot=null;revision=-2;pending=null;status='connecting';emit();const generation=epoch;
    const data=await request(path,input,null);if(generation!==epoch)return;
    session={roomCode:data.roomCode,token:data.token};persist();accept(data);schedule();return snapshot();
  }
  async function resume(){
    const previous=saved();if(!previous?.token||!previous.roomCode)throw new Error('Ingen sparad match finns.');
    stop();state=null;revision=-2;sessionSnapshot=null;session={token:previous.token,roomCode:previous.roomCode};pending=previous.pending||null;status='connecting';emit();await cycle();return snapshot();
  }
  function command(action,body){
    const generation=epoch;
    queue=queue.catch(()=>{}).then(async()=>{
      if(!session||generation!==epoch)return;
      try{const data=await request(`/rooms/${session.roomCode}/${action}`,body);if(generation===epoch)accept(data)}catch(error){if(generation===epoch)report(error)}
    });return queue;
  }
  function leave(){stop();session=null;sessionSnapshot=null;state=null;pending=null;revision=-2;status='idle';emit()}
  const controller={
    snapshot,makeRoomCode:()=>crypto.randomUUID().replaceAll('-','').slice(0,6).toUpperCase(),
    createRoom:input=>enter('/rooms',input),
    joinRoom:input=>{const code=String(input.code||'').toUpperCase();const old=saved();return old?.roomCode===code?resume():enter(`/rooms/${code}/join`,{name:input.name})},
    setMode:mode=>command('settings',{mode}),setCountries:countries=>command('settings',{countries}),startGame:()=>command('start',{}),
    canMove:()=>!!(session&&state?.status==='playing'&&status==='connected'&&!pending&&state.players[state.turn]?.onlineId===sessionSnapshot?.playerId),
    submitMove:place=>{if(!controller.canMove())throw new Error('Vänta på din tur och anslutningen.');pending={moveId:crypto.randomUUID(),placeId:String(place.id),revision};try{persist()}catch(error){pending=null;throw error}emit();if(!busy)void cycle();return true},
    leave,resume,hasSavedSession:()=>!!saved()?.token,
    // Test/runtime teardown stops polling without changing the stored match.
    destroy:leave
  };
  return controller;
}
