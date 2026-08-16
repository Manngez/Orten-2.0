'use strict';

(() => {
  const HS=window.OrtenHighscore;
  const GLOBAL=window.OrtenGlobalHighscore;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let renderToken=0;

  function soloSettings(){
    return {...settings,mode:'solo',playerCount:1,timer:0};
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

  async function renderHighscore(){
    const token=++renderToken;
    const board=soloSettings();
    const localRows=HS?.list(board)||[];
    const title=$('highscoreTitle');
    const sub=$('highscoreSub');
    const list=$('highscoreBoard');
    const kicker=$('highscoreKicker');
    const note=$('highscoreNote');
    if(!title||!sub||!list||!kicker||!note)return;

    title.textContent=`Solo · ${scopeLabel(board)}`;
    sub.textContent=ruleText(board);
    kicker.textContent=GLOBAL?'GLOBAL TOPP 10':'LOKAL TOPP 10';
    note.textContent=GLOBAL?'Hämtar den gemensamma topplistan…':'Rekorden sparas på den här enheten.';
    list.innerHTML='<div class="highscore-loading"><span></span>Hämtar highscore…</div>';

    if(!GLOBAL){list.innerHTML=rowsMarkup(localRows,'local');return}

    try{
      const remote=await GLOBAL.list(board);
      if(token!==renderToken)return;
      kicker.textContent='GLOBAL TOPP 10';
      list.innerHTML=rowsMarkup(remote.entries,'global');
      note.textContent='Gemensam topplista via Supabase. Ditt personbästa sparas även lokalt som reserv.';
    }catch(err){
      console.warn('Global highscore kunde inte hämtas.',err);
      if(token!==renderToken)return;
      kicker.textContent='LOKAL TOPP 10';
      list.innerHTML=rowsMarkup(localRows,'local');
      note.textContent='Den globala topplistan gick inte att nå just nu. Lokala rekord visas i stället.';
    }
  }

  function openHighscore(){renderHighscore();$('highscoreModal')?.classList.remove('hidden')}
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
      button.id='resultHighscoreButton';button.type='button';button.className='ghost-button';button.textContent='🏆 Highscore';
      button.addEventListener('click',openHighscore);
      resultActions.insertBefore(button,resultActions.firstChild);
    }

    const modal=document.createElement('div');
    modal.id='highscoreModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','highscoreTitle');
    modal.innerHTML=`<div class="modal-backdrop"></div><section class="modal-card highscore-modal-card"><button class="modal-close" id="highscoreClose" type="button" aria-label="Stäng">×</button><span class="step-kicker" id="highscoreKicker">GLOBAL TOPP 10</span><div class="highscore-head"><div><h2 id="highscoreTitle">Solo highscore</h2><p id="highscoreSub"></p></div></div><div id="highscoreBoard" class="highscore-board"></div><p class="highscore-note" id="highscoreNote">Hämtar topplistan…</p></section>`;
    document.body.appendChild(modal);
    $('highscoreClose')?.addEventListener('click',closeHighscore);
    modal.querySelector('.modal-backdrop')?.addEventListener('click',closeHighscore);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.classList.contains('hidden'))closeHighscore()});
    window.addEventListener('orten:global-highscore-updated',()=>{if(!modal.classList.contains('hidden'))renderHighscore()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addHighscoreUI);else addHighscoreUI();
})();
