# Orten 3.0

Orten 3.0 är en ren ombyggnad som utvecklas parallellt med Orten 2.0.

## Principer

- En enda spelmotor för lokal- och onlinespel.
- Regler är frikopplade från UI och nätverk.
- Duell: varje ny linje testas mot alla tidigare duellsegment, både egna och motståndarens.
- Ortdata ligger bakom ett eget datalager och får inte tyst falla tillbaka till en liten produktionsdatabas.
- Historik och nätverk ska konsumera spelstate i stället för att återskapa spelregler.
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
- Ett versionsmärkt onlineprotokoll med state-revisioner och skydd mot gamla state-paket.
- Host-auktoritativa onlinedrag där fel spelare inte kan göra drag utanför sin tur.
- Validering av inkommande spelstate innan en gäst accepterar det.

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

- `MOVE`: gästen föreslår en ort tillsammans med sitt spelar-id och ett unikt drag-id.
- `STATE`: värden skickar ett validerat komplett spelstate med monoton revision och eventuell kvittens av drag-id.

Värden kontrollerar att `playerId` motsvarar spelaren vars tur det är innan `playPlace()` får köras. Gästen accepterar bara nyare revisioner och vägrar ogiltigt state. Det innebär att PeerJS/WebRTC, återanslutning och framtida transport kan bytas utan att spelreglerna behöver ändras.

## Nästa steg

1. Koppla PeerJS/WebRTC-transport till det nya `MOVE`/`STATE`-protokollet.
2. Bygg den enkla V3-ingången `En enhet` / `Online`, med `Skapa rum` eller `Anslut till rum`.
3. Återanslutning genom att gästen begär senaste state-revision från värden.
4. En gemensam matchjournal för start, progress, avslut och replay.
5. Gatduell som separat regelmodul ovanpå samma sessions- och nätverkslager.
