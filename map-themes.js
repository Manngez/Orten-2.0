'use strict';

// Keep each map choice on its own real basemap. The CSS only fine-tunes
// readability; it must not be responsible for turning one theme into another.
MAP_TILE_URLS.night = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
MAP_TILE_URLS.atlas = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
MAP_TILE_URLS.paper = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';

tileUrlForTheme = function(theme){
  return MAP_TILE_URLS[theme] || MAP_TILE_URLS.night;
};
