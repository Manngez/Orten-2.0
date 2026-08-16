'use strict';

(() => {
  const params = new URL(location.href).searchParams;
  if(params.get('verktyg') !== '1' && params.get('toolbox') !== '1') return;

  let armedTarget = null;
  let armedPointerId = null;
  let suppressUntil = 0;

  const isPicking = () => document.body.classList.contains('orten-toolbox-picking');
  const isToolboxNode = node => !!node?.closest?.('#ortenToolboxRoot');

  function selectableTarget(raw){
    if(!(raw instanceof Element) || isToolboxNode(raw)) return null;
    if(['HTML','BODY','SCRIPT','STYLE','LINK','META'].includes(raw.tagName)) return null;
    const leaflet = raw.closest?.('.leaflet-container');
    if(leaflet && !raw.closest?.('.map-controls')) return leaflet;
    return raw;
  }

  function block(event){
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  document.addEventListener('pointerdown', event => {
    if(!isPicking()) return;
    const target = selectableTarget(event.target);
    if(!target) return;
    armedTarget = target;
    armedPointerId = event.pointerId;
    block(event);
  }, true);

  document.addEventListener('pointerup', event => {
    if(!isPicking()) return;
    if(armedPointerId !== null && event.pointerId !== armedPointerId) return;
    const target = armedTarget || selectableTarget(event.target);
    if(!target) return;

    block(event);
    armedTarget = null;
    armedPointerId = null;
    suppressUntil = performance.now() + 900;

    // Låt den befintliga verktygslådan göra själva valet via sitt klickflöde,
    // men använd ett syntetiskt klick efter att originalets pekhändelser blockerats.
    const synthetic = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window
    });
    target.dispatchEvent(synthetic);
  }, true);

  document.addEventListener('pointercancel', event => {
    if(armedPointerId !== null && event.pointerId === armedPointerId){
      armedTarget = null;
      armedPointerId = null;
    }
  }, true);

  // Om webbläsaren ändå skapar ett vanligt klick efter touch/pointerup ska det
  // aldrig få aktivera knappen/länken som just valdes i redigeringsläget.
  document.addEventListener('click', event => {
    if(isToolboxNode(event.target)) return;
    if(isPicking() || performance.now() < suppressUntil) block(event);
  }, true);
})();
