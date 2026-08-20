# Orten 3.0

Orten 3.0 är en ren ombyggnad som utvecklas parallellt med Orten 2.0.

## Principer

- En enda spelmotor för lokal- och onlinespel.
- Regler är frikopplade från UI och nätverk.
- Duell: varje ny linje testas mot alla tidigare duellsegment, både egna och motståndarens.
- Ortdata ligger bakom ett eget datalager och får inte tyst falla tillbaka till en liten produktionsdatabas.
- Historik och nätverk ska konsumera spelstate i stället för att återskapa spelregler.
- Kartan visualiserar state men bestämmer aldrig spelreglerna.

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

## Nästa steg

1. Online-transport som synkar exakt samma state som lokalspelsmotorn.
2. En gemensam matchjournal för start, progress, avslut och replay.
3. Återanslutning ovanpå state-synkningen utan separata onlineregler.
4. Gatduell som separat regelmodul ovanpå samma sessions- och nätverkslager.
5. Fler spelinställningar först när kärnflödet är stabilt och enkelt.
