'use strict';

(() => {
  const params = new URL(location.href).searchParams;
  if(params.get('verktyg') !== '1' && params.get('toolbox') !== '1') return;

  const HEIGHT_KEY = 'orten2:toolbox:mobile-height:v1';
  const root = document.getElementById('ortenToolboxRoot');
  const panel = document.getElementById('ortenToolboxPanel');
  const head = panel?.querySelector('.toolbox-head');
  const launcher = document.getElementById('ortenToolboxLauncher');
  if(!root || !panel || !head || !launcher) return;

  const isMobile = () => matchMedia('(max-width: 600px)').matches;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

  function limits(){
    const viewport = window.visualViewport?.height || window.innerHeight || 700;
    return {
      min: Math.min(300, Math.max(230, viewport * .32)),
      max: Math.max(320, viewport - 72)
    };
  }

  function storedHeight(){
    const value = Number(localStorage.getItem(HEIGHT_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function applyStoredHeight(){
    if(!isMobile()){
      panel.style.removeProperty('--toolbox-mobile-height');
      return;
    }
    const saved = storedHeight();
    if(!saved) return;
    const {min,max} = limits();
    panel.style.setProperty('--toolbox-mobile-height', `${Math.round(clamp(saved,min,max))}px`);
  }

  function syncPanelState(){
    const open = panel.classList.contains('open');
    root.classList.toggle('toolbox-panel-is-open',open);
    launcher.setAttribute('aria-expanded',open ? 'true' : 'false');
  }

  const classObserver = new MutationObserver(syncPanelState);
  classObserver.observe(panel,{attributes:true,attributeFilter:['class']});
  syncPanelState();
  applyStoredHeight();

  let dragging = false;
  let pointerId = null;
  let startY = 0;
  let startHeight = 0;

  function beginDrag(event){
    if(!isMobile() || event.button > 0 || event.target.closest('button,input,textarea,select,a')) return;
    const rect = panel.getBoundingClientRect();
    dragging = true;
    pointerId = event.pointerId;
    startY = event.clientY;
    startHeight = rect.height;
    root.classList.add('toolbox-sheet-dragging');
    head.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event){
    if(!dragging || event.pointerId !== pointerId) return;
    const {min,max} = limits();
    const next = clamp(startHeight + (startY - event.clientY), min, max);
    panel.style.setProperty('--toolbox-mobile-height', `${Math.round(next)}px`);
    event.preventDefault();
  }

  function endDrag(event){
    if(!dragging || (pointerId !== null && event.pointerId !== pointerId)) return;
    dragging = false;
    root.classList.remove('toolbox-sheet-dragging');
    try{head.releasePointerCapture?.(pointerId)}catch{}
    pointerId = null;
    const height = Math.round(panel.getBoundingClientRect().height);
    if(isMobile() && height > 0) localStorage.setItem(HEIGHT_KEY,String(height));
  }

  head.addEventListener('pointerdown',beginDrag);
  head.addEventListener('pointermove',moveDrag);
  head.addEventListener('pointerup',endDrag);
  head.addEventListener('pointercancel',endDrag);

  window.addEventListener('resize',applyStoredHeight,{passive:true});
  window.visualViewport?.addEventListener('resize',applyStoredHeight,{passive:true});
})();
