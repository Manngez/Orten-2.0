'use strict';

  const D = window.OrtenData;
  const PLAYER_COLORS = ['#68f6ff','#ff8f70','#ffd86a','#73f5a7','#c69cff','#75a7ff'];
  const SEARCH_CACHE_LIMIT = 120;
  const NORDIC_CODES = ['SE','NO','FI','DK','IS'];

  const $ = id => document.getElementById(id);
  const els = {};
  let map = null;
  let tileLayer = null;
  let routeLayer = null;
  let toastTimer = null;
  let crossBannerTimer = null;
  let gameTimer = null;
  let searchWorker = null;
  let searchRequestId = 0;
  let placeDataReady = false;
  let placeDataCount = 0;
  const searchPending = new Map();
  const searchCache = new Map();
  let mapProgrammatic = false;
  let userNavigatingUntil = 0;
  let placeChooserOpen = false;

  const settings = {
    mode: 'classic', scope: 'country', continent: 'europe', country: 'SE', countries: [],
    placeType: 'any', mapTheme: 'night', autoFollow: true, labels: false,
    playerCount: 2, playerNames: ['Spelare 1','Spelare 2','Spelare 3','Spelare 4','Spelare 5','Spelare 6'],
    strikeLimit: 2, timer: 0, duplicatePolicy: 'exact', preset: null
  };

  const game = {
    active:false, paused:false, finished:false, currentIndex:0, route:[], players:[], settings:null,
    lastCrossings:[], totalCrossings:0, totalMoves:0, roundMoves:0, bestRound:0, round:1,
    pendingNextRound:false, timerRemaining:0, followEnabled:true, initialView:null
  };

  function esc(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function storageGet(key){try{return localStorage.getItem(key)}catch{return null}}
  function storageSet(key,value){try{localStorage.setItem(key,value)}catch{}}
  function norm(value='') { return String(value).trim().toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim(); }
  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
  function showScreen(name){
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(`${name}Screen`)?.classList.add('active');
  }

  function ensureDuelModeControls(){
    // Huvudmenyn ska vara enkel: Klassisk, Tålighet och Solo.
    // Äldre speciallägen finns kvar i spelmotorn för historik/bakåtkompatibilitet,
    // men visas inte längre som primära spellägen.
    els.modeGrid?.querySelector('[data-mode="elimination"]')?.remove();
    els.modeGrid?.querySelector('[data-mode="duel"]')?.remove();
    if(els.strikeLimitSelect && !els.strikeLimitSelect.querySelector('option[value="1"]')){
      const option=new Option('1 korsning','1');els.strikeLimitSelect.insertBefore(option,els.strikeLimitSelect.firstChild);
    }
  }

  function tone(kind='move'){
    if (storageGet('orten2:sound') === 'off') return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); const now = ctx.currentTime;
      osc.type = kind === 'cross' ? 'sawtooth' : kind === 'start' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(kind === 'cross' ? 230 : 420, now);
      osc.frequency.exponentialRampToValueAtTime(kind === 'cross' ? 92 : (kind === 'start' ? 760 : 650), now + (kind === 'cross' ? .35 : .13));
      gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(.07,now+.012); gain.gain.exponentialRampToValueAtTime(.0001,now+(kind==='cross'?.4:.18));
      osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now+(kind==='cross'?.42:.2));
      setTimeout(() => ctx.close(), 520);
    } catch {}
  }

  function updateSound(){ els.soundButton.textContent = storageGet('orten2:sound') === 'off' ? '🔇' : '🔊'; }
  function toast(message,type='info',ms=3000){
    clearTimeout(toastTimer); els.toast.textContent=message; els.toast.classList.remove('hidden','error'); if(type==='error')els.toast.classList.add('error');
    toastTimer=setTimeout(()=>els.toast.classList.add('hidden'),ms);
  }

  function setupCountryControls(){
    Object.entries(D.CONTINENT_META).forEach(([key,meta]) => els.continentSelect.add(new Option(meta.name,key)));
    D.sortedCountries().forEach(c => els.countrySelect.add(new Option(`${c.flag} ${c.name}`,c.code)));
    els.countrySelect.value = settings.country;
    renderCountryChips();
  }

  function renderCountryChips(filter=''){
    const q=norm(filter);
    const selected=new Set(settings.countries);
    els.countryChips.innerHTML='';
    const list=D.sortedCountries().filter(c=>!q || norm(`${c.name} ${c.code}`).includes(q));
    const frag=document.createDocumentFragment();
    list.forEach(c=>{
      const b=document.createElement('button'); b.type='button'; b.className=`country-chip${selected.has(c.code)?' active':''}`; b.dataset.code=c.code;
      b.textContent=`${c.flag} ${c.name}`; b.addEventListener('click',()=>{
        if(selected.has(c.code)) selected.delete(c.code); else selected.add(c.code);
        settings.countries=[...selected]; settings.preset=null; renderCountryChips(els.countrySearch.value); updateSetupUI(false);
      }); frag.appendChild(b);
    });
    els.countryChips.appendChild(frag);
  }

  function renderPresets(){
    els.presetGrid.innerHTML='';
    Object.entries(D.PRESETS).forEach(([key,p])=>{
      const b=document.createElement('button'); b.type='button'; b.className=`preset-card${settings.preset===key?' active':''}`;
      b.innerHTML=`<span>${p.icon}</span><strong>${esc(p.label)}</strong>`; b.addEventListener('click',()=>applyPreset(key)); els.presetGrid.appendChild(b);
    });
  }

  function applyPreset(key){
    const p=D.PRESETS[key]; if(!p)return;
    settings.preset=key; settings.mode=p.mode; settings.scope=p.scope; settings.placeType=p.placeType; settings.playerCount=p.playerCount; settings.mapTheme=p.mapTheme;
    if(p.country) settings.country=p.country;
    if(p.countries) settings.countries=[...p.countries];
    if(p.strikeLimit) settings.strikeLimit=p.strikeLimit;
    normalizePlayerCount(); updateSetupUI(true); toast(`${p.icon} ${p.label} vald.`);
  }

  function normalizePlayerCount(){
    // Gamla Utslagning/Duell-inställningar landar tryggt i Klassisk i den nya förenklade menyn.
    if(settings.mode==='elimination'||settings.mode==='duel') settings.mode='classic';
    if(settings.mode==='solo') settings.playerCount=1;
    else settings.playerCount=clamp(settings.playerCount,2,6);
  }

  function renderPlayerCount(){
    const select=els.playerCountSelect; const old=settings.playerCount; select.innerHTML='';
    const min=settings.mode==='solo'?1:2;
    const max=settings.mode==='solo'?1:6;
    for(let i=min;i<=max;i++) select.add(new Option(`${i} spelare`,String(i)));
    settings.playerCount=clamp(old,min,max); select.value=String(settings.playerCount);
  }

  function renderPlayerInputs(){
    els.playerInputs.innerHTML='';
    for(let i=0;i<settings.playerCount;i++){
      const row=document.createElement('label'); row.className='player-input';
      row.innerHTML=`<i style="background:${PLAYER_COLORS[i]};color:${PLAYER_COLORS[i]}"></i><input maxlength="24" aria-label="Namn spelare ${i+1}" value="${esc(settings.playerNames[i]||`Spelare ${i+1}`)}">`;
      row.querySelector('input').addEventListener('input',e=>{settings.playerNames[i]=e.target.value;settings.preset=null;updateSummary();});
      els.playerInputs.appendChild(row);
    }
  }

  function scopeCodes(s=settings){
    if(s.scope==='world') return null;
    if(s.scope==='continent') return D.CONTINENTS[s.continent] || [];
    if(s.scope==='country') return [s.country];
    if(s.scope==='custom') return [...(s.countries||[])];
    return null;
  }

  function isNordicScope(s=settings){
    if(s.scope!=='custom' || (s.countries||[]).length!==NORDIC_CODES.length) return false;
    const set=new Set(s.countries||[]);
    return NORDIC_CODES.every(code=>set.has(code));
  }

  function currentAreaKey(s=settings){
    if(s.scope==='country' && s.country==='SE') return 'sweden';
    if(isNordicScope(s)) return 'nordic';
    if(s.scope==='continent' && s.continent==='europe') return 'europe';
    return 'world';
  }

  function scopeLabel(s=settings){
    if(s.scope==='world') return 'Världen';
    if(s.scope==='continent') return D.CONTINENT_META[s.continent]?.name || 'Världsdel';
    if(s.scope==='country') return `${D.flag(s.country)} ${D.countryName(s.country)}`;
    if(isNordicScope(s)) return '❄️ Norden';
    const codes=s.countries||[];
    if(!codes.length) return 'Inga länder valda';
    if(codes.length<=3) return codes.map(c=>`${D.flag(c)} ${D.countryName(c)}`).join(', ');
    return `${codes.length} valda länder`;
  }

  function modeLabel(mode=settings.mode){
    return {classic:'Klassisk',endurance:'Tålighet',elimination:'Utslagning',duel:'Duell',solo:'Solo'}[mode] || mode;
  }
  function modeIcon(mode=settings.mode){ return {classic:'⚡',endurance:'🛡️',elimination:'🏆',duel:'⚔️',solo:'🧭'}[mode]||'🎯'; }
  function placeTypeLabel(type=settings.placeType){ return {any:'Alla spelbara orter',urban:'Städer & större orter',city:'Städer & huvudorter'}[type]||type; }
  function themeLabel(theme=settings.mapTheme){ return {night:'Natt',atlas:'Atlas',paper:'Papper'}[theme]||theme; }

  function updateSetupUI(rebuildCountries=false){
    ensureDuelModeControls(); normalizePlayerCount(); renderPresets();
    els.modeGrid.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===settings.mode));
    const area=currentAreaKey();
    els.scopeTabs.querySelectorAll('[data-area]').forEach(b=>b.classList.toggle('active',b.dataset.area===area));
    els.continentBox.classList.add('hidden'); els.countryBox.classList.add('hidden'); els.customBox.classList.add('hidden');
    els.continentSelect.value=settings.continent; els.countrySelect.value=settings.country;
    if(rebuildCountries) renderCountryChips(els.countrySearch.value);
    els.scopeCount.textContent=scopeLabel();
    document.querySelectorAll('input[name="placeType"]').forEach(r=>{r.checked=r.value===settings.placeType;r.closest('.option-row')?.classList.toggle('selected',r.checked)});
    els.themeGrid.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('selected',b.dataset.theme===settings.mapTheme));
    els.autoFollowToggle.checked=settings.autoFollow; els.labelsToggle.checked=settings.labels;
    renderPlayerCount(); renderPlayerInputs();
    const usesStrikes=settings.mode==='endurance';
    els.strikeCard.classList.toggle('hidden',!usesStrikes);
    const strikeLabel=els.strikeCard.querySelector('label');if(strikeLabel)strikeLabel.textContent='Korsningar innan förlust';
    const strikeHelp=els.strikeCard.querySelector('small');if(strikeHelp)strikeHelp.textContent='Visas bara i Tålighet.';
    els.strikeLimitSelect.value=String(settings.strikeLimit); els.timerSelect.value=String(settings.timer); els.duplicateSelect.value=settings.duplicatePolicy;
    updateSummary();
  }
