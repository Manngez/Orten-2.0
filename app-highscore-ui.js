'use strict';

(() => {
  const HS=window.OrtenHighscore;
  const GLOBAL=window.OrtenGlobalHighscore;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let renderToken=0;

  function soloSettings(){
    return {...settings,mode:'solo',playerCount:1,timer:0};
  }

  function isFinishedSoloGame(){
    return !!(game?.finished&&game?.settings?.mode==='solo');
  }

  function currentPlayerName(){
    if(isFinishedSoloGame())return game?.players?.[0]?.name||'Spelare 1';
    return settings?.playerNames?.[0]||'Spelare 1';
  }

  function ruleText(board){
    return `${placeTypeLabel(board.placeType)} · ${board.duplicatePolicy==='exact'?'unik faktisk plats':board.duplicatePolicy==='nameCountry'?'namn + land':'återanvändning tillåten'}`;
  }

  function rowsMarkup(rows,source){
    if(!rows.length){
      const where=source==='global'?'på den globala listan':'på den här enheten';
      return `<div class="highscore-empty"><strong>Ingen har satt rekord ${where} ännu.</strong><br>Spela Solo och bli först på listan.</div>`;
    }
    return rows.map((row,index)=>{
      const medal=index===0?'🥇':index===1?'🥈':index===2?'🥉':`#${index+1}`;
      const date=HS.formatDate(row.date);
      const meta=source==='global'?(date?`${date} · globalt`:'Globalt rekord'):(date||'Lokalt rekord');
      return `<div class="highscore-row"><div class="highscore-rank">${medal}</div><div class="highscore-player"><strong>${safe(row.name)}</strong><small>${safe(meta)}</small></div><div class="highscore-score">${row.score}<small>ORTER</small></div></div>`;
    }).join('');
  }

  function friendlyError(err){
    const raw=String(err?.message||err||'').toLowerCase();
    if(raw.includes('anonymous')&&(raw.includes('disabled')||raw.includes('not enabled')))return 'Anonym spelaridentitet är inte aktiverad i Supabase.';
    if(raw.includes('row-level')||raw.includes('row level')||raw.includes('permission')||raw.includes('policy'))return 'Supabase säkerhetsregler blockerar sparandet.';
    if(raw.includes('relation')||raw.includes('does not exist')||raw.includes('not found'))return 'Highscore-tabellen kunde inte hittas i Supabase.';
    if(raw.includes('fetch')||raw.includes('network')||raw.includes('load'))return 'Kunde inte nå Supabase just nu.';
    return 'Global synk misslyckades. Ditt lokala rekord är fortfarande sparat.';
  }

  function renderMine(board){
    const mine=$('highscoreMine');
    if(!mine)return null;
    const player=currentPlayerName();
    const best=HS?.best(board,player)||null;
    if(!best){
      mine.innerHTML='<div class="highscore-mine-empty"><span>DITT REKORD</span><strong>Inget Solo-rekord sparat ännu</strong></div>';
      return null;
    }
    mine.innerHTML=`<div class="highscore-mine-card"><div><span>DITT REKORD PÅ DEN HÄR ENHETEN</span><strong>${safe(best.name)}</strong></div><div class="highscore-mine-score">${best.score}<small>ORTER</small></div></div>`;
    return best;
  }

  async function loadGlobal(board,best,token){
    const list=$('highscoreBoard');
    const kicker=$('highscoreKicker');
    const note=$('highscoreNote');
    const retry=$('highscoreRetry');
    if(!list||!kicker||!note||!retry)return;

    if(!GLOBAL){
      kicker.textContent='LOKAL TOPP 10';
      note.textContent='Den globala tjänsten är inte laddad. Ditt rekord finns kvar på enheten.';
      retry.classList.add('hidden');
      return;
    }

    retry.classList.toggle('hidden',!(best&&isFinishedSoloGame()));
    try{
      // Highscore-vyn är strikt läsande. Den får aldrig skapa ett resultat.
      const remote=await GLOBAL.list(board);
      if(token!==renderToken)return;
      kicker.textContent='GLOBAL TOPP 10';
      list.innerHTML=rowsMarkup(remote.entries||[],'global');
      note.textContent=best
        ? 'Ditt lokala Solo-rekord visas ovan. Den globala listan hämtas från Supabase.'
        : 'Gemensam topplista via Supabase.';
      note.classList.remove('highscore-error-note');
    }catch(err){
      console.warn('Global highscore kunde inte hämtas.',err);
      if(token!==renderToken)return;
      kicker.textContent='GLOBAL SYNK EJ KLAR';
      list.innerHTML='<div class="highscore-empty"><strong>Den globala topplistan kunde inte laddas.</strong><br>Ditt lokala rekord visas fortfarande nedan.</div>';
      note.textContent=friendlyError(err);
      note.classList.add('highscore-error-note');
    }
  }

  async function renderHighscore(){
    const token=++renderToken;
    const board=soloSettings();
    const localRows=HS?.list(board)||[];
    const title=$('highscoreTitle');
    const sub=$('highscoreSub');
    const list=$('highscoreBoard');
    const localList=$('highscoreLocalBoard');
    const kicker=$('highscoreKicker');
    const note=$('highscoreNote');
    if(!title||!sub||!list||!localList||!kicker||!note)return;

    title.textContent=`Solo · ${scopeLabel(board)}`;
    sub.textContent=ruleText(board);
    kicker.textContent=GLOBAL?'GLOBAL TOPP 10':'LOKAL TOPP 10';
    note.textContent=GLOBAL?'Hämtar den gemensamma Solo-topplistan…':'Rekorden sparas på den här enheten.';
    note.classList.remove('highscore-error-note');
    list.innerHTML='<div class="highscore-loading"><span></span>Hämtar highscore…</div>';
    localList.innerHTML=rowsMarkup(localRows,'local');
    const best=renderMine(board);

    if(!GLOBAL){
      list.innerHTML=rowsMarkup(localRows,'local');
      return;
    }
    await loadGlobal(board,best,token);
  }

  async function retrySync(){
    const button=$('highscoreRetry');
    if(!isFinishedSoloGame()){
      button?.classList.add('hidden');
      return;
    }
    const board={...game.settings};
    const player=game.players?.[0]?.name||'Spelare 1';
    const best=HS?.best(board,player)||null;
    if(!best||!GLOBAL)return;
    if(button){button.disabled=true;button.textContent='Synkar…'}
    try{
      await GLOBAL.record({settings:board,playerName:best.name,score:best.score,source:'solo-result'});
      await renderHighscore();
    }catch(err){
      const note=$('highscoreNote');
      if(note){note.textContent=friendlyError(err);note.classList.add('highscore-error-note')}
    }finally{
      if(button){button.disabled=false;button.textContent='↻ Försök synka igen'}
    }
  }

  function openHighscore(){
    $('highscoreModal')?.classList.remove('hidden');
    renderHighscore();
  }
  function closeHighscore(){renderToken++;$('highscoreModal')?.classList.add('hidden')}

  function addHighscoreUI(){
    if(!HS||$('highscoreModal'))return;
    const topActions=document.querySelector('#setupScreen .topbar-actions');
    if(topActions){
      const button=document.createElement('button');
      button.id='highscoreButton';button.type='button';button.className='ghost-button highscore-button';button.textContent='🏆 Highscore';
      button.addEventListener('click',openHighscore);
      topActions.insertBefore(button,topActions.lastElementChild||null);
    }

    const resultActions=document.querySelector('#resultModal .result-actions');
    if(resultActions){
      const button=document.createElement('button');
      button.id='resultHighscoreButton';button.type='button';button.className='ghost-button hidden';button.textContent='🏆 Highscore';
      button.addEventListener('click',openHighscore);
      resultActions.insertBefore(button,resultActions.firstChild);
    }

    const modal=document.createElement('div');
    modal.id='highscoreModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','highscoreTitle');
    modal.innerHTML=`<div class="modal-backdrop"></div><section class="modal-card highscore-modal-card"><button class="modal-close" id="highscoreClose" type="button" aria-label="Stäng">×</button><span class="step-kicker" id="highscoreKicker">GLOBAL TOPP 10</span><div class="highscore-head"><div><h2 id="highscoreTitle">Solo highscore</h2><p id="highscoreSub"></p></div></div><div id="highscoreMine" class="highscore-mine"></div><div id="highscoreBoard" class="highscore-board"></div><div class="highscore-sync-actions"><button id="highscoreRetry" type="button" class="ghost-button hidden">↻ Försök synka igen</button></div><p class="highscore-note" id="highscoreNote">Hämtar topplistan…</p><div class="highscore-local-section"><span class="highscore-section-label">PÅ DEN HÄR ENHETEN</span><div id="highscoreLocalBoard" class="highscore-board"></div></div></section>`;
    document.body.appendChild(modal);
    $('highscoreClose')?.addEventListener('click',closeHighscore);
    $('highscoreRetry')?.addEventListener('click',retrySync);
    modal.querySelector('.modal-backdrop')?.addEventListener('click',closeHighscore);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.classList.contains('hidden'))closeHighscore()});
    window.addEventListener('orten:global-highscore-updated',()=>{if(!modal.classList.contains('hidden'))renderHighscore()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addHighscoreUI);else addHighscoreUI();
})();
