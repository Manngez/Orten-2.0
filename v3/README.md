# Orten 3.0

Orten 3.0 är en ren ombyggnad som utvecklas parallellt med Orten 2.0.

## Principer

- En enda spelmotor för lokal- och onlinespel.
- Regler är frikopplade från UI och nätverk.
- Duell: varje ny linje testas mot alla tidigare duellsegment, både egna och motståndarens.
- Ortdata ligger bakom ett eget datalager och får inte tyst falla tillbaka till en liten produktionsdatabas.
- Historik och nätverk ska konsumera spelstate i stället för att återskapa spelregler.

## Nuvarande milstolpe

Den första spelbara kärnan innehåller Klassisk, Solo och Duell. V3 använder nu det fulla GeoNames cities500-registret som en versionsmärkt dataprodukt. Bygget skapar manifest med antal orter, landantal, filstorlek och SHA-256, och klienten vägrar starta en match om registret inte klarar samma integritetskontroll.

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

1. Riktig kartprojektion och kartlager.
2. Snabbt sökindex för det fulla ortregistret på mobil.
3. Online-transport som synkar samma state som lokalspelsmotorn.
4. En gemensam matchjournal för start, progress, avslut och replay.
5. Gatduell som separat regelmodul ovanpå samma sessions- och nätverkslager.
