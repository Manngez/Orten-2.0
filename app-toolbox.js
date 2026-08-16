'use strict';

(() => {
  const currentSrc = document.currentScript?.src || '';
  const params = new URL(location.href).searchParams;
  if (params.get('verktyg') !== '1' && params.get('toolbox') !== '1') return;

  const STORAGE_KEY = 'orten2:toolbox:overrides:v1';
  const PANEL_STATE_KEY = 'orten2:toolbox:panel-open:v1';
  const rootId = 'ortenToolboxRoot';

  let overrides = loadOverrides();
  let selected = null;
  let selectedSelector = '';
  let picking = false;
  let applying = false;
  let observerQueued = false;

  loadStyles();
  buildUI();
  applyAllOverrides();
  observeDom();

  function loadStyles(){
    if(document.querySelector('link[data-orten-toolbox-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.ortenToolboxStyle = 'true';
    try{
      const url = new URL('styles-toolbox.css', currentSrc || location.href);
      const version = new URL(currentSrc || location.href).searchParams.get('v');
      if(version) url.searchParams.set('v', version);
      link.href = url.href;
    }catch{
      link.href = 'styles-toolbox.css';
    }
    document.head.appendChild(link);
  }

  function loadOverrides(){
    try{
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }catch{
      return {};
    }
  }

  function saveOverrides(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    refreshJson();
    refreshCount();
  }

  function escSelector(value){
    if(window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/([^\w-])/g, '\\$1');
  }

  function nthOfType(el){
    const parent = el.parentElement;
    if(!parent) return '';
    const same = [...parent.children].filter(child => child.localName === el.localName);
    if(same.length <= 1) return '';
    return `:nth-of-type(${same.indexOf(el) + 1})`;
  }

  function selectorFor(el){
    if(!(el instanceof Element)) return '';
    if(el.id) return `#${escSelector(el.id)}`;
    const parts = [];
    let node = el;
    while(node && node !== document.body && node !== document.documentElement){
      if(node.id){
        parts.unshift(`#${escSelector(node.id)}`);
        break;
      }
      parts.unshift(`${node.localName}${nthOfType(node)}`);
      node = node.parentElement;
    }
    if(node === document.body) parts.unshift('body');
    return parts.join(' > ');
  }

  function isToolboxNode(el){
    return !!el?.closest?.(`#${rootId}`);
  }

  function selectableTarget(raw){
    if(!(raw instanceof Element)) return null;
    if(isToolboxNode(raw)) return null;
    if(['HTML','BODY','SCRIPT','STYLE','LINK','META'].includes(raw.tagName)) return null;
    const leaflet = raw.closest?.('.leaflet-container');
    if(leaflet && !raw.closest?.('.map-controls')) return leaflet;
    return raw;
  }

  function readText(el){
    if(!el) return '';
    if(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return '';
    if(!el.children.length) return el.textContent ?? '';
    const textNodes = [...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim());
    return textNodes.map(node => node.nodeValue.trim()).join(' ');
  }

  function writeText(el, value){
    if(!el || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
    if(!el.children.length){
      if(el.textContent !== value) el.textContent = value;
      return;
    }
    const textNodes = [...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim());
    if(textNodes.length){
      if(textNodes[0].nodeValue !== value) textNodes[0].nodeValue = value;
      for(let i=1;i<textNodes.length;i++) if(textNodes[i].nodeValue) textNodes[i].nodeValue = '';
    }else if(value){
      el.insertBefore(document.createTextNode(value), el.firstChild);
    }
  }

  function rgbToHex(value){
    const match = String(value || '').match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if(!match) return '#000000';
    return '#' + [match[1],match[2],match[3]]
      .map(n => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2,'0'))
      .join('');
  }

  function currentStyle(el, prop, fallback=''){
    const inline = el?.style?.getPropertyValue(prop);
    if(inline) return inline;
    try{return getComputedStyle(el).getPropertyValue(prop).trim() || fallback}catch{return fallback}
  }

  function getOverride(selector){
    if(!overrides[selector]) overrides[selector] = {styles:{}, attrs:{}};
    if(!overrides[selector].styles) overrides[selector].styles = {};
    if(!overrides[selector].attrs) overrides[selector].attrs = {};
    return overrides[selector];
  }

  function compactOverride(selector){
    const item = overrides[selector];
    if(!item) return;
    const hasStyles = item.styles && Object.values(item.styles).some(value => value !== '' && value != null);
    const hasAttrs = item.attrs && Object.values(item.attrs).some(value => value !== '' && value != null);
    const hasText = Object.prototype.hasOwnProperty.call(item,'text');
    const hasHidden = item.hidden === true;
    const hasCss = !!item.customCss;
    if(!hasStyles && !hasAttrs && !hasText && !hasHidden && !hasCss) delete overrides[selector];
  }

  function setStyleOverride(prop, value){
    if(!selectedSelector) return;
    const item = getOverride(selectedSelector);
    const clean = String(value ?? '').trim();
    if(clean) item.styles[prop] = clean;
    else delete item.styles[prop];
    applyOverride(selected, item);
    compactOverride(selectedSelector);
    saveOverrides();
  }

  function setAttrOverride(name, value){
    if(!selectedSelector) return;
    const item = getOverride(selectedSelector);
    const clean = String(value ?? '');
    if(clean !== '') item.attrs[name] = clean;
    else delete item.attrs[name];
    applyOverride(selected, item);
    compactOverride(selectedSelector);
    saveOverrides();
  }

  function applyCustomCss(el, cssText){
    if(!cssText) return;
    const temp = document.createElement('div');
    temp.style.cssText = cssText;
    for(let i=0;i<temp.style.length;i++){
      const prop = temp.style.item(i);
      const value = temp.style.getPropertyValue(prop);
      if(value && (el.style.getPropertyValue(prop) !== value || el.style.getPropertyPriority(prop) !== 'important')){
        el.style.setProperty(prop, value, 'important');
      }
    }
  }

  function applyOverride(el, item){
    if(!el || !item) return;
    applying = true;
    try{
      if(Object.prototype.hasOwnProperty.call(item,'text')) writeText(el, String(item.text ?? ''));
      for(const [name,value] of Object.entries(item.attrs || {})){
        if(name === 'value' && 'value' in el){
          if(String(el.value) !== String(value)) el.value = value;
        }else if(name === 'src' && el instanceof HTMLImageElement){
          if(el.getAttribute('src') !== value) el.setAttribute('src', value);
        }else if(el.getAttribute?.(name) !== value){
          el.setAttribute?.(name, value);
        }
      }
      for(const [prop,value] of Object.entries(item.styles || {})){
        if(value && (el.style.getPropertyValue(prop) !== value || el.style.getPropertyPriority(prop) !== 'important')){
          el.style.setProperty(prop, value, 'important');
        }
      }
      if(item.hidden === true && (el.style.getPropertyValue('display') !== 'none' || el.style.getPropertyPriority('display') !== 'important')){
        el.style.setProperty('display','none','important');
      }
      applyCustomCss(el, item.customCss);
    }finally{
      applying = false;
    }
  }

  function applyAllOverrides(){
    applying = true;
    try{
      for(const [selector,item] of Object.entries(overrides)){
        let nodes = [];
        try{nodes = [...document.querySelectorAll(selector)]}catch{continue}
        for(const el of nodes) applyOverride(el,item);
      }
    }finally{
      applying = false;
    }
  }

  function observeDom(){
    const observer = new MutationObserver(() => {
      if(applying || observerQueued) return;
      observerQueued = true;
      requestAnimationFrame(() => {
        observerQueued = false;
        applyAllOverrides();
      });
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','src','placeholder','value']});
  }

  function setPicking(next){
    picking = !!next;
    document.body.classList.toggle('orten-toolbox-picking',picking);
    const button = document.getElementById('toolboxPick');
    if(button){
      button.classList.toggle('active',picking);
      button.textContent = picking ? '✕ Avbryt val' : '🎯 Välj på skärmen';
    }
    status(picking ? 'Tryck på något i spelet för att redigera det.' : 'Redigeringsval avstängt.');
  }

  function selectElement(el){
    document.querySelectorAll('.toolbox-selected').forEach(node => node.classList.remove('toolbox-selected'));
    selected = selectableTarget(el);
    if(!selected){
      selectedSelector = '';
      refreshInspector();
      return;
    }
    selectedSelector = selectorFor(selected);
    selected.classList.add('toolbox-selected');
    refreshInspector();
    setPicking(false);
    status(`Valt: ${selectedSelector}`);
  }

  function refreshInspector(){
    const empty = document.getElementById('toolboxEmpty');
    const form = document.getElementById('toolboxInspector');
    if(!empty || !form) return;
    const has = !!selected && !!selectedSelector;
    empty.classList.toggle('hidden',has);
    form.classList.toggle('hidden',!has);
    if(!has) return;

    const item = overrides[selectedSelector] || {styles:{},attrs:{}};
    const computed = getComputedStyle(selected);
    setValue('toolboxSelector',selectedSelector);
    setValue('toolboxTag',`<${selected.localName}>${selected.id ? ` #${selected.id}` : ''}`);
    setValue('toolboxText',Object.prototype.hasOwnProperty.call(item,'text') ? item.text : readText(selected));
    setValue('toolboxValue',Object.prototype.hasOwnProperty.call(item.attrs || {},'value') ? item.attrs.value : ('value' in selected ? selected.value : ''));
    setValue('toolboxPlaceholder',Object.prototype.hasOwnProperty.call(item.attrs || {},'placeholder') ? item.attrs.placeholder : (selected.getAttribute?.('placeholder') || ''));
    setValue('toolboxSrc',Object.prototype.hasOwnProperty.call(item.attrs || {},'src') ? item.attrs.src : (selected instanceof HTMLImageElement ? selected.getAttribute('src') || '' : ''));
    setValue('toolboxTitle',Object.prototype.hasOwnProperty.call(item.attrs || {},'title') ? item.attrs.title : (selected.getAttribute?.('title') || ''));
    setValue('toolboxAria',Object.prototype.hasOwnProperty.call(item.attrs || {},'aria-label') ? item.attrs['aria-label'] : (selected.getAttribute?.('aria-label') || ''));

    setValue('toolboxFontSize',parseFloat(item.styles?.['font-size'] || computed.fontSize) || '');
    setValue('toolboxFontWeight',item.styles?.['font-weight'] || computed.fontWeight || '');
    setValue('toolboxAlign',item.styles?.['text-align'] || computed.textAlign || '');
    setValue('toolboxColor',rgbToHex(item.styles?.color || computed.color));
    setValue('toolboxBg',rgbToHex(item.styles?.['background-color'] || computed.backgroundColor));
    setValue('toolboxBorderColor',rgbToHex(item.styles?.['border-color'] || computed.borderColor));
    setValue('toolboxBorderWidth',parseFloat(item.styles?.['border-width'] || computed.borderWidth) || 0);
    setValue('toolboxRadius',parseFloat(item.styles?.['border-radius'] || computed.borderRadius) || 0);
    setValue('toolboxPadding',item.styles?.padding || currentStyle(selected,'padding'));
    setValue('toolboxMargin',item.styles?.margin || currentStyle(selected,'margin'));
    setValue('toolboxWidth',item.styles?.width || '');
    setValue('toolboxHeight',item.styles?.height || '');
    setValue('toolboxOpacity',parseFloat(item.styles?.opacity || computed.opacity) || 1);

    const translate = String(item.styles?.translate || '').trim().split(/\s+/);
    setValue('toolboxX',parseFloat(translate[0]) || 0);
    setValue('toolboxY',parseFloat(translate[1]) || 0);
    document.getElementById('toolboxVisible').checked = item.hidden !== true;
    setValue('toolboxCss',item.customCss || '');

    toggleRow('toolboxTextRow',!(selected instanceof HTMLInputElement || selected instanceof HTMLTextAreaElement || selected instanceof HTMLSelectElement));
    toggleRow('toolboxValueRow','value' in selected);
    toggleRow('toolboxPlaceholderRow',selected instanceof HTMLInputElement || selected instanceof HTMLTextAreaElement);
    toggleRow('toolboxSrcRow',selected instanceof HTMLImageElement);
  }

  function setValue(id,value){
    const el = document.getElementById(id);
    if(el) el.value = value ?? '';
  }

  function toggleRow(id,show){
    document.getElementById(id)?.classList.toggle('hidden',!show);
  }

  function refreshCount(){
    const count = document.getElementById('toolboxChangeCount');
    if(count) count.textContent = `${Object.keys(overrides).length} ändrade element`;
  }

  function refreshJson(){
    const area = document.getElementById('toolboxJson');
    if(area && document.activeElement !== area) area.value = JSON.stringify(overrides,null,2);
  }

  function status(message,isError=false){
    const node = document.getElementById('toolboxStatus');
    if(!node) return;
    node.textContent = message;
    node.classList.toggle('error',!!isError);
  }

  function bind(id,event,handler){
    document.getElementById(id)?.addEventListener(event,handler);
  }

  function bindStyle(id,prop,unit=''){
    bind(id,'input',event => {
      const value = event.target.value;
      setStyleOverride(prop,value === '' ? '' : `${value}${unit}`);
    });
  }

  function syncTranslate(){
    if(!selectedSelector) return;
    const x = Number(document.getElementById('toolboxX')?.value || 0);
    const y = Number(document.getElementById('toolboxY')?.value || 0);
    setStyleOverride('translate', x || y ? `${x}px ${y}px` : '');
  }

  function copyJson(){
    const text = JSON.stringify(overrides,null,2);
    const done = () => status('Ändringarna är kopierade. Skicka JSON-texten till ChatGPT när du vill göra dem permanenta.');
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text,done));
    }else fallbackCopy(text,done);
  }

  function fallbackCopy(text,done){
    const area = document.getElementById('toolboxJson');
    if(!area) return;
    area.value = text;
    area.focus();
    area.select();
    try{document.execCommand('copy');done()}catch{status('Kunde inte kopiera automatiskt. Markera JSON-texten manuellt.',true)}
  }

  function importJson(){
    const area = document.getElementById('toolboxJson');
    if(!area) return;
    try{
      const parsed = JSON.parse(area.value || '{}');
      if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Fel format');
      overrides = parsed;
      saveOverrides();
      applyAllOverrides();
      refreshInspector();
      status('JSON-ändringarna har lästs in.');
    }catch{
      status('JSON-texten kunde inte läsas. Kontrollera att den är komplett.',true);
    }
  }

  function resetSelected(){
    if(!selectedSelector) return;
    if(!overrides[selectedSelector]){
      status('Det valda elementet har inga sparade ändringar.');
      return;
    }
    delete overrides[selectedSelector];
    saveOverrides();
    location.reload();
  }

  function resetAll(){
    if(!Object.keys(overrides).length){
      status('Det finns inga sparade ändringar.');
      return;
    }
    if(!confirm('Återställa alla visuella ändringar på den här enheten?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  function normalMode(){
    const url = new URL(location.href);
    url.searchParams.delete('verktyg');
    url.searchParams.delete('toolbox');
    location.href = url.href;
  }

  function buildUI(){
    if(document.getElementById(rootId)) return;
    const root = document.createElement('div');
    root.id = rootId;
    root.innerHTML = `
      <button id="ortenToolboxLauncher" class="toolbox-launcher" type="button" aria-label="Öppna verktygslådan">🧰</button>
      <aside id="ortenToolboxPanel" class="toolbox-panel" aria-label="Visuell verktygslåda">
        <header class="toolbox-head">
          <div><small>ORTEN 2.0 · LOKAL REDIGERING</small><strong>🧰 Verktygslåda</strong></div>
          <button id="toolboxClose" type="button" aria-label="Stäng">×</button>
        </header>

        <div class="toolbox-intro">
          <span id="toolboxChangeCount">0 ändrade element</span>
          <p>Tryck på ett synligt element och ändra det direkt. Inget här påverkar andra spelare förrän ändringarna byggs in i spelet.</p>
        </div>

        <div class="toolbox-actions">
          <button id="toolboxPick" class="primary" type="button">🎯 Välj på skärmen</button>
          <button id="toolboxNormal" type="button">↗ Öppna normalt</button>
        </div>

        <div id="toolboxEmpty" class="toolbox-empty">
          <strong>Inget element valt</strong>
          <span>Tryck på “Välj på skärmen” och sedan på texten, knappen, bilden eller rutan du vill ändra.</span>
        </div>

        <div id="toolboxInspector" class="toolbox-inspector hidden">
          <section class="toolbox-section">
            <div class="toolbox-section-title"><strong>Valt element</strong><button id="toolboxResetElement" type="button">Återställ</button></div>
            <label class="toolbox-field readonly"><span>Element</span><input id="toolboxTag" readonly></label>
            <label class="toolbox-field readonly"><span>Selector</span><input id="toolboxSelector" readonly></label>
          </section>

          <section class="toolbox-section">
            <h3>Innehåll</h3>
            <label id="toolboxTextRow" class="toolbox-field"><span>Text</span><textarea id="toolboxText" rows="3"></textarea></label>
            <label id="toolboxValueRow" class="toolbox-field hidden"><span>Värde</span><input id="toolboxValue"></label>
            <label id="toolboxPlaceholderRow" class="toolbox-field hidden"><span>Platshållare</span><input id="toolboxPlaceholder"></label>
            <label id="toolboxSrcRow" class="toolbox-field hidden"><span>Bildkälla</span><input id="toolboxSrc"></label>
            <div class="toolbox-grid">
              <label class="toolbox-field"><span>Tooltip</span><input id="toolboxTitle"></label>
              <label class="toolbox-field"><span>ARIA-etikett</span><input id="toolboxAria"></label>
            </div>
          </section>

          <section class="toolbox-section">
            <h3>Text & färg</h3>
            <div class="toolbox-grid">
              <label class="toolbox-field"><span>Textstorlek px</span><input id="toolboxFontSize" type="number" min="1" step="1"></label>
              <label class="toolbox-field"><span>Textvikt</span><input id="toolboxFontWeight" inputmode="numeric"></label>
              <label class="toolbox-field"><span>Textfärg</span><input id="toolboxColor" type="color"></label>
              <label class="toolbox-field"><span>Bakgrund</span><input id="toolboxBg" type="color"></label>
              <label class="toolbox-field"><span>Justering</span><select id="toolboxAlign"><option value="left">Vänster</option><option value="center">Centrerad</option><option value="right">Höger</option><option value="start">Start</option><option value="end">Slut</option></select></label>
              <label class="toolbox-field"><span>Opacitet</span><input id="toolboxOpacity" type="number" min="0" max="1" step="0.05"></label>
            </div>
          </section>

          <section class="toolbox-section">
            <h3>Ruta & placering</h3>
            <div class="toolbox-grid">
              <label class="toolbox-field"><span>Kantfärg</span><input id="toolboxBorderColor" type="color"></label>
              <label class="toolbox-field"><span>Kant px</span><input id="toolboxBorderWidth" type="number" min="0" step="1"></label>
              <label class="toolbox-field"><span>Rundning px</span><input id="toolboxRadius" type="number" min="0" step="1"></label>
              <label class="toolbox-field"><span>Padding</span><input id="toolboxPadding" placeholder="t.ex. 12px 16px"></label>
              <label class="toolbox-field"><span>Margin</span><input id="toolboxMargin" placeholder="t.ex. 0 0 12px"></label>
              <label class="toolbox-field"><span>Bredd</span><input id="toolboxWidth" placeholder="auto / 300px / 80%"></label>
              <label class="toolbox-field"><span>Höjd</span><input id="toolboxHeight" placeholder="auto / 120px"></label>
              <label class="toolbox-field"><span>Flytta X px</span><input id="toolboxX" type="number" step="1"></label>
              <label class="toolbox-field"><span>Flytta Y px</span><input id="toolboxY" type="number" step="1"></label>
              <label class="toolbox-check"><input id="toolboxVisible" type="checkbox" checked><span>Elementet ska vara synligt</span></label>
            </div>
          </section>

          <section class="toolbox-section">
            <h3>Avancerat</h3>
            <label class="toolbox-field"><span>Egen CSS</span><textarea id="toolboxCss" rows="3" placeholder="box-shadow: 0 0 20px cyan; letter-spacing: 1px;"></textarea></label>
          </section>
        </div>

        <details class="toolbox-export">
          <summary>Import / export</summary>
          <p>Kopiera detta till ChatGPT när du vill göra ändringarna permanenta i Orten.</p>
          <textarea id="toolboxJson" rows="8" spellcheck="false"></textarea>
          <div class="toolbox-actions">
            <button id="toolboxCopy" type="button">Kopiera JSON</button>
            <button id="toolboxImport" type="button">Läs in JSON</button>
          </div>
        </details>

        <div class="toolbox-danger">
          <button id="toolboxResetAll" type="button">Återställ alla lokala ändringar</button>
        </div>
        <p id="toolboxStatus" class="toolbox-status">Verktygslådan är redo.</p>
      </aside>`;
    document.body.appendChild(root);

    const panel = document.getElementById('ortenToolboxPanel');
    const launcher = document.getElementById('ortenToolboxLauncher');
    const startOpen = localStorage.getItem(PANEL_STATE_KEY) !== '0';
    panel.classList.toggle('open',startOpen);

    launcher.addEventListener('click',()=>{panel.classList.add('open');localStorage.setItem(PANEL_STATE_KEY,'1')});
    bind('toolboxClose','click',()=>{panel.classList.remove('open');localStorage.setItem(PANEL_STATE_KEY,'0');setPicking(false)});
    bind('toolboxPick','click',()=>setPicking(!picking));
    bind('toolboxNormal','click',normalMode);
    bind('toolboxResetElement','click',resetSelected);
    bind('toolboxResetAll','click',resetAll);
    bind('toolboxCopy','click',copyJson);
    bind('toolboxImport','click',importJson);

    bind('toolboxText','input',event=>{
      if(!selectedSelector) return;
      const item = getOverride(selectedSelector);
      item.text = event.target.value;
      applyOverride(selected,item);
      saveOverrides();
    });
    bind('toolboxValue','input',event=>setAttrOverride('value',event.target.value));
    bind('toolboxPlaceholder','input',event=>setAttrOverride('placeholder',event.target.value));
    bind('toolboxSrc','input',event=>setAttrOverride('src',event.target.value));
    bind('toolboxTitle','input',event=>setAttrOverride('title',event.target.value));
    bind('toolboxAria','input',event=>setAttrOverride('aria-label',event.target.value));

    bindStyle('toolboxFontSize','font-size','px');
    bindStyle('toolboxFontWeight','font-weight');
    bindStyle('toolboxColor','color');
    bindStyle('toolboxBg','background-color');
    bindStyle('toolboxAlign','text-align');
    bindStyle('toolboxOpacity','opacity');
    bindStyle('toolboxBorderColor','border-color');
    bindStyle('toolboxBorderWidth','border-width','px');
    bindStyle('toolboxRadius','border-radius','px');
    bindStyle('toolboxPadding','padding');
    bindStyle('toolboxMargin','margin');
    bindStyle('toolboxWidth','width');
    bindStyle('toolboxHeight','height');
    bind('toolboxX','input',syncTranslate);
    bind('toolboxY','input',syncTranslate);
    bind('toolboxVisible','change',event=>{
      if(!selectedSelector) return;
      const item = getOverride(selectedSelector);
      item.hidden = !event.target.checked;
      if(item.hidden) selected.style.setProperty('display','none','important');
      else{
        delete item.hidden;
        selected.style.removeProperty('display');
      }
      compactOverride(selectedSelector);
      saveOverrides();
    });
    bind('toolboxCss','input',event=>{
      if(!selectedSelector) return;
      const item = getOverride(selectedSelector);
      item.customCss = event.target.value.trim();
      applyOverride(selected,item);
      compactOverride(selectedSelector);
      saveOverrides();
    });

    document.addEventListener('pointerover',event=>{
      if(!picking) return;
      document.querySelectorAll('.toolbox-hover').forEach(node=>node.classList.remove('toolbox-hover'));
      const target = selectableTarget(event.target);
      if(target) target.classList.add('toolbox-hover');
    },true);

    document.addEventListener('pointerout',event=>{
      if(!picking) return;
      selectableTarget(event.target)?.classList.remove('toolbox-hover');
    },true);

    document.addEventListener('click',event=>{
      if(!picking) return;
      const target = selectableTarget(event.target);
      if(!target) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      target.classList.remove('toolbox-hover');
      selectElement(target);
    },true);

    document.addEventListener('keydown',event=>{
      if(event.key === 'Escape' && picking){event.preventDefault();setPicking(false)}
    });

    refreshJson();
    refreshCount();
  }
})();
