'use strict';

window.OrtenData = (() => {
  const ISO_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' ');

  const CONTINENTS = {
    europe: `AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA`.split(' '),
    africa: `AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW`.split(' '),
    asia: `AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IO IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE`.split(' '),
    northAmerica: `AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI`.split(' '),
    southAmerica: `AR BO BR CL CO EC FK GF GS GY PE PY SR UY VE`.split(' '),
    oceania: `AS AU CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS`.split(' '),
    antarctica: `AQ BV TF`.split(' ')
  };

  const CONTINENT_META = {
    europe: {name:'Europa', center:[54,16], zoom:3.5},
    africa: {name:'Afrika', center:[2,20], zoom:3},
    asia: {name:'Asien', center:[34,90], zoom:2.6},
    northAmerica: {name:'Nordamerika', center:[42,-101], zoom:2.8},
    southAmerica: {name:'Sydamerika', center:[-16,-60], zoom:3},
    oceania: {name:'Oceanien', center:[-20,145], zoom:2.8},
    antarctica: {name:'Antarktis', center:[-78,15], zoom:2.3}
  };

  const PRESETS = {
    world: {label:'Världen', icon:'🌍', mode:'classic', scope:'world', placeType:'any', playerCount:2, mapTheme:'night'},
    sweden: {label:'Sverige', icon:'🇸🇪', mode:'classic', scope:'country', country:'SE', placeType:'any', playerCount:2, mapTheme:'atlas', center:[62,15], zoom:4.2},
    nordic: {label:'Norden', icon:'❄️', mode:'classic', scope:'custom', countries:['SE','NO','FI','DK','IS'], placeType:'any', playerCount:2, mapTheme:'night', center:[64,14], zoom:3.5},
    cities: {label:'Världens städer', icon:'🏙️', mode:'endurance', scope:'world', placeType:'urban', playerCount:3, strikeLimit:2, mapTheme:'atlas'},
    explorer: {label:'Explorer', icon:'🧭', mode:'solo', scope:'world', placeType:'any', playerCount:1, mapTheme:'paper'},
    knockout: {label:'Utslagning', icon:'⚔️', mode:'elimination', scope:'world', placeType:'urban', playerCount:4, mapTheme:'night'}
  };

  const svNames = (() => {
    try { return new Intl.DisplayNames(['sv'], {type:'region'}); } catch { return null; }
  })();

  function countryName(code) {
    try { return svNames?.of(code) || code; } catch { return code; }
  }

  function flag(code) {
    if (!/^[A-Z]{2}$/.test(code || '')) return '🌐';
    return String.fromCodePoint(...code.toUpperCase().split('').map(ch => 127397 + ch.charCodeAt(0)));
  }

  function sortedCountries(codes = ISO_CODES) {
    return [...codes]
      .map(code => ({code, name:countryName(code), flag:flag(code)}))
      .sort((a,b) => a.name.localeCompare(b.name, 'sv'));
  }

  return {ISO_CODES, CONTINENTS, CONTINENT_META, PRESETS, countryName, flag, sortedCountries};
})();
