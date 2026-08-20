const clone=value=>structuredClone(value);

function shortId(value){
  const text=String(value||'');
  if(text.length<=18)return text||'—';
  return `${text.slice(0,8)}…${text.slice(-6)}`;
}

function timeLabel(timestamp){
  return new Date(timestamp).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

export function createOnlineDiagnostics({enabled=false,getSnapshot=()=>null,getState=()=>null,getCanMove=()=>false}={}){
  if(!enabled)return {record(){},refresh(){},destroy(){}};

  const panel=document.createElement('aside');
  panel.className='online-debug';
  panel.innerHTML=`
    <div class="online-debug-head">
      <div><span>V3 TEST</span><b>Nätverksdiagnostik</b></div>
      <button type="button" data-debug-toggle aria-label="Minimera diagnostik">−</button>
    </div>
    <div class="online-debug-body">
      <pre data-debug-report></pre>
      <div class="online-debug-actions">
        <button type="button" data-debug-copy>Kopiera rapport</button>
        <button type="button" data-debug-clear>Rensa logg</button>
      </div>
    </div>`;
  document.body.appendChild(panel);

  const reportEl=panel.querySelector('[data-debug-report]');
  const events=[];
  let collapsed=false;

  function record(type,detail=''){
    events.push({at:Date.now(),type:String(type||'event'),detail:String(detail||'')});
    if(events.length>32)events.splice(0,events.length-32);
    refresh();
  }

  function report(){
    const snapshot=getSnapshot?.()||{};
    const state=getState?.()||null;
    const players=(snapshot.players||[]).map(player=>`${player.name}:${player.connected===false?'OFF':'ON'}`).join(', ')||'—';
    const current=state?.players?.[state.turn]?.name||'—';
    const lines=[
      `roll: ${snapshot.role||'offline'}`,
      `status: ${snapshot.status||'idle'}`,
      `rum: ${snapshot.roomCode||'—'}`,
      `playerId: ${shortId(snapshot.playerId)}`,
      `revision: ${Number.isInteger(snapshot.revision)?snapshot.revision:'—'}`,
      `pending move: ${snapshot.pending?'JA':'nej'}`,
      `kan spela: ${getCanMove?.()?'JA':'nej'}`,
      `spelare: ${players}`,
      `tur: ${current}`,
      `drag i state: ${state?.places?.length??0}`,
      '',
      'senaste händelser:'
    ];
    for(const event of events.slice(-12))lines.push(`${timeLabel(event.at)}  ${event.type}${event.detail?` · ${event.detail}`:''}`);
    return lines.join('\n');
  }

  function refresh(){if(reportEl)reportEl.textContent=report()}

  panel.querySelector('[data-debug-toggle]').addEventListener('click',event=>{
    collapsed=!collapsed;
    panel.classList.toggle('collapsed',collapsed);
    event.currentTarget.textContent=collapsed?'+':'−';
  });
  panel.querySelector('[data-debug-clear]').addEventListener('click',()=>{events.length=0;record('logg','rensad')});
  panel.querySelector('[data-debug-copy]').addEventListener('click',async event=>{
    const text=`Orten 3.0 online-diagnostik\n${report()}`;
    try{await navigator.clipboard.writeText(text);event.currentTarget.textContent='✓ Kopierad';setTimeout(()=>{event.currentTarget.textContent='Kopiera rapport'},1400)}catch{event.currentTarget.textContent='Kunde inte kopiera'}
  });

  const timer=setInterval(refresh,500);
  record('debug','startad');
  return {record,refresh,destroy(){clearInterval(timer);panel.remove()},snapshot(){return clone({events,report:report()})}};
}
