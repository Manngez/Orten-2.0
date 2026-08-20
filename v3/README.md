# Orten 3.0

Orten 3.0 är en ren ombyggnad som utvecklas parallellt med Orten 2.0.

## Principer

- En enda spelmotor för lokal- och onlinespel.
- Regler är frikopplade från UI och nätverk.
- Duell: varje ny linje testas mot alla tidigare duellsegment, både egna och motståndarens.
- Ortdata ligger bakom ett eget datalager och får inte tyst falla tillbaka till en liten produktionsdatabas.
- Historik och nätverk ska konsumera spelstate i stället för att återskapa spelregler.

## Nuvarande milstolpe

Första spelbara kärnan innehåller Klassisk, Solo och Duell. Den kan köras med ett litet inbyggt utvecklingsregister medan det fulla ortregistret byggs som en separat, versionsmärkt dataprodukt.

## Nästa steg

1. Permanent fullt GeoNames-register med manifest och integritetskontroll.
2. Riktig kartprojektion och kartlager.
3. Online-transport som synkar samma state som lokalspelsmotorn.
4. En gemensam matchjournal för start, progress, avslut och replay.
5. Gatduell som separat regelmodul ovanpå samma sessions- och nätverkslager.
