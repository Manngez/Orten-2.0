# Orten 3.0

Orten 3.0 är en ren ombyggnad som utvecklas parallellt med Orten 2.0.

## Principer

- En enda spelmotor för lokal- och onlinespel.
- Regler är frikopplade från UI och nätverk.
- Duell: varje ny linje testas mot alla tidigare duellsegment, både egna och motståndarens.
- Ortdata ligger bakom ett eget datalager och får inte tyst falla tillbaka till en liten produktionsdatabas.
- Historik och nätverk konsumerar spelstate i stället för att återskapa spelregler.
- Kartan visualiserar state men bestämmer aldrig spelreglerna.
- Onlinegäster skickar dragförslag; värden är auktoritativ och kör draget genom samma `playPlace()` som lokalt spel.

## Nuvarande milstolpe

Den spelbara kärnan innehåller Klassisk, Solo och Duell. V3 använder det fulla GeoNames cities500-registret som en versionsmärkt dataprodukt. Bygget skapar manifest med antal orter, landantal, filstorlek och SHA-256, och klienten vägrar starta en match om registret inte klarar samma integritetskontroll.

V3 har nu också:

- Web Mercator-baserad korsningsgeometri med korrekt hantering av datumgränsen.
- En interaktiv Leaflet-karta med etikettfritt mörkt kartlager.
- Automatisk följning av rutten som pausar när spelaren själv navigerar kartan.
- Delning av linjer vid ±180° så att rutter över datumgränsen ritas korrekt.
- Klickbara spelade orter för snabb återfokusering.
- Indexerad ortsökning som slipper skanna 150 000+ orter för varje tangenttryckning.
- Stöd för GeoNames-alias och accentoberoende sökning, till exempel `umea` → `Umeå`.
- En förenklad första sida med bara `En enhet` och `Online`.
- Onlineflöde med `Skapa rum` eller `Anslut till rum`, femteckens rumskod och separat lobby.
- Värdstyrda onlineinställningar för Klassisk eller Duell innan matchstart.
- PeerJS/WebRTC-transport ovanpå det versionsmärkta `MOVE`/`STATE`-protokollet.
- Host-auktoritativa onlinedrag där fel spelare inte kan göra drag utanför sin tur.
- State-revisioner som gör att gamla nätverkspaket ignoreras.
- Automatisk gäståteranslutning med samma spelar-id och återleverans av senaste state.
- Idempotenta MOVE-paket: tappade drag kan skickas om med samma drag-id utan att spelas dubbelt.
- TURN-konfiguration via `globalThis.ORTEN_TURN` när sådan finns tillgänglig.
- Värdverifiering av varje onlinedrags GeoNames-id mot värdens eget verifierade ortregister; klientskickade koordinater används inte som auktoritativ data.
- Ett dolt tvåmobil-diagnostikläge som aktiveras med `?debug=1` och inte påverkar den normala spelvyn.
- Gemensam matchjournal för lokalspel och onlinevärd.
- Lokal historik över färdiga och avbrutna matcher.
- Replay på samma karta med steg bakåt och framåt genom hela matchen.

Det lilla utvecklingsregistret finns kvar endast i explicit demoläge via `?demo=1`. Ett vanligt nätverks- eller datafel får aldrig tyst göra V3 spelbart med ofullständig data.

## Datakontrakt

`data/world-manifest.json` genereras tillsammans med `data/world-places.json` och innehåller:

- `schemaVersion`
- `dataset`
- `version`
- `generatedAt`
- `source`
- `count`
- `countryCount`
- `bytes`
- `sha256`

GitHub Pages-flödet kör V3:s tester, bygger hela GeoNames-registret och validerar manifest + datafil innan publicering.

## Onlinekontrakt

`src/online-protocol.js` är transportoberoende. Det definierar två centrala meddelanden:

- `MOVE`: klienten föreslår en ort tillsammans med sitt spelar-id och ett unikt drag-id.
- `STATE`: värden skickar ett validerat komplett spelstate med monoton revision och eventuell kvittens av drag-id.

`src/online.js` ansvarar för transport, rum, lobby och återanslutning. När värden tar emot ett `MOVE` används endast ortens id för att slå upp den kanoniska orten i värdens verifierade datalager. Därefter kontrolleras spelar-id och turordning innan samma `playPlace()` som lokalspel använder får köras.

Gästens identitet binds till PeerJS-anslutningens metadata i stället för ett självrapporterat `playerId` i MOVE-paketet. Värden minns nyligen hanterade drag-id:n och kan därför kvittera ett återsänt drag utan att spela det igen.

Gästen accepterar bara nyare state-revisioner. Om själva MOVE-paketet eller STATE-kvittensen försvinner behåller gästen sitt väntande drag och skickar om samma drag-id efter återanslutning. Värden skickar samtidigt senaste state igen.

## Matchjournal och historik

`src/journal.js` används av både lokalspel och onlinevärd. Gästen skapar ingen konkurrerande auktoritativ historik.

Varje journal innehåller start-state och ett replaysteg per spelat drag. I minnet behålls fulla state för snabb replay. Vid lagring i `localStorage` kompakteras journalen till start-state + den nya orten för varje steg, så en lång match inte sparar hela växande rutten om och om igen.

Historiken visar senaste färdiga och avbrutna matcher och replay använder samma spelmotor för att bygga tillbaka varje steg. Om webbläsaren blockerar `localStorage` fortsätter själva spelet fungera; historiken degraderar då bara till otillgänglig.

## Tvåmobil-diagnostik

Lägg till `?debug=1` i V3-adressen för att visa den flytande panelen **Nätverksdiagnostik**. Normalt spel visar aldrig panelen.

Panelen visar bland annat:

- roll: värd eller gäst
- PeerJS-status
- rumskod och förkortat spelar-id
- senaste accepterade state-revision
- om ett drag väntar på kvittens
- om den lokala klienten får spela just nu
- vilka spelare som är anslutna
- aktuell tur och antal drag i state
- en tidsstämplad logg över status-, lobby-, MOVE-, STATE-, browser online/offline-, visibility- och JavaScript-felhändelser

Knappen `Kopiera rapport` gör det möjligt att ta ut hela diagnostiken från en mobil. Lobbyknappen `Dela rum` skapar en direktlänk med `?room=KOD`; om värden själv kör `debug=1` följer debug-parametern med till testlänken så båda mobilerna kan logga samma test.

## Testning

V3:s `npm test` kontrollerar JavaScript-syntax för huvudflöde, online-transport, diagnostik och journal och kör motor-, geometri-, data-, sök-, journal- och onlinetester.

`online-flow.test.js` använder en minnesbaserad PeerJS-ersättning och testar hela kedjan: skapa rum, anslut, starta match, värddrag, gästdrag och synkat state. Testet skickar även manipulerade koordinater och verifierar att värdens kanoniska ortdata används.

`online-resilience.test.js` täcker identitetsspoofing, replay av gamla drag-id:n, återanslutning efter omladdning, tappad STATE-kvittens och ett MOVE-paket som aldrig nådde värden. I båda paketförlustfallen ska draget efter återanslutning spelas exakt en gång.

`journal.test.js` täcker start/progress, färdig match, avbruten match, replay, kompakt lagring, historikbegränsning och blockerad lokal lagring. Den senaste lokala kontrollen av journalmodulen passerade 5/5 tester.

## Nästa steg

1. Köra diagnostikläget på två verkliga enheter och använda rapporterna för eventuella PeerJS-/mobilkantfall.
2. Återupptagning av värdrum efter full siduppdatering.
3. Gatduell som separat regelmodul ovanpå samma sessions- och nätverkslager.
4. Förbereda frivillig synkning av matchhistorik till serverdatabasen i stället för enbart lokal lagring.
5. När V3 är verifierad: flytta onlineflödet från utvecklingsgren till publicerbar V3-version.
