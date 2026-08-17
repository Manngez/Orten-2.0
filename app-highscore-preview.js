'use strict';

(() => {
  const HS=window.OrtenHighscore;
  const GLOBAL=window.OrtenGlobalHighscore;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let renderToken=0;
  let refreshTimer=null;

  function soloSettings(){
    return {...settings,mode:'solo',playerCount:1,timer:0};
  }

  function previewRows(rows){
    const top=(rows||[]).slice(0,3);
    if(!top.length){
      return '<div class="highscore-preview-empty">Inga Solo-rekord ännu — bli först på listan.</div>';
    }
    return top.map((row,index)=>{
      const medal=index===0?'🥇':index===1?'🥈':'🥉';
      return `<div class="highscore-preview-entry"><span class="highscore-preview-rank">${medal}</span><div class="highscore-preview-player"><strong>${safe(row.name||'Spelare')}</strong><small>${index===0?'Ledare':`Plats ${index+1}`}</small></div><div class="highscore-preview-score">${Number(row.score)||0}<small>ORTER</small></div></div>`;
    }).join('');
  }

  async function renderPreview(){
    const root=$('highscorePreview');
    const boardEl=$('highscorePreviewBoard');
    const titleEl=$('highscorePreviewTitle');
    const sourceEl=$('highscorePreviewSource');
    if(!root||!boardEl||!titleEl||!sourceEl)return;

    const token=++renderToken;
    const board=soloSettings();
    titleEl.textContent=`Solo · ${scopeLabel(board)}`;
    sourceEl.textContent=GLOBAL?'GLOBAL TOPP 3':'LOKAL TOPP 3';
    boardEl.innerHTML='<div class="highscore-preview-loading"><span></span>Hämtar highscore…</div>';

    if(GLOBAL){
      try{
        const remote=await GLOBAL.list(board);
        if(token!==renderToken)return;
        sourceEl.textContent='GLOBAL TOPP 3';
        boardEl.innerHTML=previewRows(remote?.entries||[]);
        root.classList.remove('local-fallback');
        return;
      }catch(err){
        console.warn('Highscore på startsidan kunde inte hämtas globalt.',err);
      }
    }

    if(token!==renderToken)return;
    const localRows=HS?.list(board)||[];
    sourceEl.textContent='LOKAL TOPP 3';
    boardEl.innerHTML=previewRows(localRows);
    root.classList.add('local-fallback');
  }

  function scheduleRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(renderPreview,100);
  }

  function addPreview(){
    if($('highscorePreview'))return;
    const hero=document.querySelector('#setupScreen .hero');
    if(!hero)return;

    const section=document.createElement('section');
    section.id='highscorePreview';
    section.className='wrap highscore-preview';
    section.innerHTML=`<div class="highscore-preview-card"><div class="highscore-preview-head"><div class="highscore-preview-title-wrap"><span class="highscore-preview-trophy" aria-hidden="true">🏆</span><div><span class="step-kicker" id="highscorePreviewSource">GLOBAL TOPP 3</span><h2 id="highscorePreviewTitle">Solo highscore</h2></div></div><button id="highscorePreviewOpen" class="ghost-button" type="button">Visa topp 10</button></div><div id="highscorePreviewBoard" class="highscore-preview-board" aria-live="polite"></div></div>`;
    hero.insertAdjacentElement('afterend',section);

    $('highscorePreviewOpen')?.addEventListener('click',()=>$('highscoreButton')?.click());
    document.querySelector('#setupScreen')?.addEventListener('change',scheduleRefresh);
    document.querySelector('#scopeTabs')?.addEventListener('click',event=>{
      if(event.target.closest('[data-area]'))scheduleRefresh();
    });
    window.addEventListener('orten:global-highscore-updated',scheduleRefresh);
    renderPreview();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addPreview);else addPreview();
})();
