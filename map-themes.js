'use strict';

(() => {
  const THEME_CSS_ID = 'orten-map-theme-runtime-css';
  const currentSrc = document.currentScript?.src || '';
  let build = 'dev';
  try { build = new URL(currentSrc, location.href).searchParams.get('v') || 'dev'; } catch {}

  if (!document.getElementById(THEME_CSS_ID)) {
    const link = document.createElement('link');
    link.id = THEME_CSS_ID;
    link.rel = 'stylesheet';
    link.href = `styles-map-themes.css?v=${encodeURIComponent(build)}`;
    document.head.appendChild(link);
  }

  const THEME_TILE_URLS = {
    night: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    atlas: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
    paper: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
  };

  Object.assign(MAP_TILE_URLS, THEME_TILE_URLS);

  tileUrlForTheme = function(theme) {
    const safe = ['night', 'atlas', 'paper'].includes(theme) ? theme : 'night';
    return THEME_TILE_URLS[safe];
  };

  applyMapTheme = function(theme) {
    const safe = ['night', 'atlas', 'paper'].includes(theme) ? theme : 'night';

    els.map.classList.remove('theme-night', 'theme-atlas', 'theme-paper');
    els.map.classList.add(`theme-${safe}`);
    els.gameScreen.classList.remove('theme-night-ui', 'theme-atlas-ui', 'theme-paper-ui');
    els.gameScreen.classList.add(`theme-${safe}-ui`);

    if (!map) return;

    const url = tileUrlForTheme(safe);
    if (tileLayer && tileLayer._url === url && tileLayer._ortenTheme === safe) return;

    const oldLayer = tileLayer;
    if (oldLayer && map.hasLayer(oldLayer)) map.removeLayer(oldLayer);

    tileLayer = L.tileLayer(url, {
      subdomains: 'abcd',
      maxZoom: 20,
      updateWhenIdle: false,
      keepBuffer: 3,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    });
    tileLayer._ortenTheme = safe;
    tileLayer.addTo(map);
    if (typeof tileLayer.bringToBack === 'function') tileLayer.bringToBack();

    requestAnimationFrame(() => map.invalidateSize({ pan: false }));
  };
})();
