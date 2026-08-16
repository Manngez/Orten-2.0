'use strict';

(() => {
  const HS=window.OrtenHighscore;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function soloSettings(){
    return {...settings,mode:'solo',playerCount:1,timer:0};
  }

  function renderHighscore(){
    const board=soloSettings();
    const rows=HS?.list(board)||[];
    const title=$('highscoreTitle');
    const sub=$('highscoreSub');
    const list=$('highscoreBoard');
    if(!title||!sub||!list)return;
    title.textContent=`Solo · ${scopeLabel(board)}`;
    sub.textContent=`${placeTypeLabel(board.placeType)} · ${board.duplicatePolicy==='exact'?'unik faktisk plats':board.duplicatePolicy==='nameCountry'?'namn + land':'återanvändning tillåten'}`;
    if(!rows.length){
      list.innerHTML='<div class="highscore-empty"><strong>Ingen har satt rekord ännu.</strong><br>Spela Solo och bli först på listan.</div>';
      return;
    }
    list.innerHTML=rows.map((row,index)=>{
      const medal=index===0?'🥇':index===1?'🥈':index===2?'🥉':`#${index+1}`;
      const date=HS.formatDate(row.date);
      return `<div class="highscore-row"><div class="highscore-rank">${medal}</div><div class="highscore-player"><strong>${safe(row.name)}</strong><small>${safe(date||'Lokalt rekord')}</small></div><div class="highscore-score">${row.score}<small>ORTER</small></div></div>`;
    }).join('');
  }

  function openHighscore(){renderHighscore();$('highscoreModal')?.classList.remove('hidden')}
  function closeHighscore(){$('highscoreModal')?.classList.add('hidden')}

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
    modal.innerHTML=`<div class="modal-backdrop"></div><section class="modal-card highscore-modal-card"><button class="modal-close" id="highscoreClose" type="button" aria-label="Stäng">×</button><span class="step-kicker">LOKAL TOPP 10</span><div class="highscore-head"><div><h2 id="highscoreTitle">Solo highscore</h2><p id="highscoreSub"></p></div></div><div id="highscoreBoard" class="highscore-board"></div><p class="highscore-note">Rekorden sparas på den här enheten. Listan är uppbyggd så att global synkning kan kopplas på senare utan att ändra spelreglerna.</p></section>`;
    document.body.appendChild(modal);
    $('highscoreClose')?.addEventListener('click',closeHighscore);
    modal.querySelector('.modal-backdrop')?.addEventListener('click',closeHighscore);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.classList.contains('hidden'))closeHighscore()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addHighscoreUI);else addHighscoreUI();
})();
