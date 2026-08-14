# Orten 2.0

Orten 2.0 är en ny, fristående version av geografspelet Orten. Spelarna väljer riktiga orter och varje ny ort kopplas till den föregående. En linjekorsning utlöser den valda korsningsregeln.

Den här versionen är byggd med Geoline-känsla i plats- och kartflödet, men med ett eget globalt ortregister och fler spelinställningar.

## Det viktigaste i 2.0

- Global täckning med GeoNames `cities500`: orter över 500 invånare samt administrativa huvudorter i hela världen.
- Ortsökning sker lokalt i en Web Worker efter att världsdatan byggts in vid publicering. Ingen live-geokodning behövs under spelet.
- Leaflet 1.9.4 + OpenStreetMap med fri panorering, pinch-zoom, scrollzoom, smart följning och snabbknappar.
- Dateline-säker ruttvisning och korsningsberäkning runt ±180° longitud.
- Identiska ortnamn hanteras med unik GeoNames-identitet, land, region och koordinat.
- Välj hela världen, en världsdel, ett land eller en egen kombination av länder.
- Tre ortfilter: alla spelbara orter, 5 000+, eller 15 000+/administrativa huvudorter.
- Fyra spellägen: Klassisk, Tålighet, Utslagning och Solo.
- 1–6 spelare beroende på spelläge.
- Valbar turtid, korsningsgräns, dubblettregel, karttema, etiketter och automatisk kartföljning.
- Snabbpresets för Världen, Sverige, Norden, Världens städer, Explorer och Utslagning.
- Responsivt gränssnitt för mobil, surfplatta och desktop.
- GitHub Pages-workflow bygger världsdatan och publicerar automatiskt från `main`.

## Ortsnamn och dubbletter

Standardregeln är **Samma faktiska plats får inte återanvändas**.

Varje ort från GeoNames har ett unikt `geonameId`. Därför kan två verkligt olika platser med samma namn användas utan att blandas ihop. Om flera platser matchar en sökning visas en väljare med:

- flagga och land
- region
- orttyp
- koordinater

Vid många träffar kan spelaren skriva exempelvis `Springfield, Illinois` eller `Victoria, Australia` för att begränsa listan.

Tre dubblettregler finns:

1. **Exakt plats** – rekommenderad. Samma GeoNames-plats blockeras, men andra orter med samma namn är tillåtna.
2. **Namn + land** – striktare. Samma namn inom samma land blockeras.
3. **Tillåt allt** – ingen dubblettkontroll.

## Världsdatan

`scripts/build-world-data.mjs` hämtar GeoNames `cities500.zip` och `admin1CodesASCII.txt` under GitHub Actions-körningen. Därefter skapas:

- `data/world-places.json` – kompakt globalt ortregister
- `data/world-meta.json` – antal orter och land/territorier i den aktuella byggningen

GeoNames anger ungefär 185 000 poster i `cities500`. Registret innehåller orter med fler än 500 invånare samt administrativa huvudorter ner till PPLA4.

För att även få rimlig träff på alternativa skrivsätt lagras ASCII-formen för alla orter och ett begränsat antal alternativa namn för större orter och administrativa huvudorter.

Repot innehåller också en liten fallback-fil med världens huvudstäder så att gränssnittet går att provköra innan första Actions-byggningen. Vid riktig publicering skrivs fallback-filen över av det fullständiga GeoNames-registret.

## Sökprestanda

`place-worker.js` laddar och söker ortregistret utanför huvudtråden. Det gör att panorering, kartanimationer och UI inte behöver låsa sig när en global sökning görs.

Sökningen prioriterar i ordning:

1. exakt officiellt namn
2. exakt alternativt namn/translitterering
3. namn som börjar med sökningen
4. delsträngsmatchning
5. större och administrativa orter vid lika bra namnmatchning

Om spelaren skriver en region eller ett land efter kommatecken prioriteras och, när det finns träffar, filtreras listan på den kvalificeraren.

## Kartmotor

Rutten lagrar en kontinuerlig, avvecklad longitud (`ux`) för korsningsberäkningen. När en sträcka passerar datumlinjen delas den visuellt vid ±180° så att linjen inte ritas fel väg tvärs över kartan.

Kartnavigering är användarstyrd:

- drag/pinch/scroll fungerar direkt
- automatisk följning pausas efter manuell navigering
- senaste ort kan centreras med ett tryck
- hela rutten kan passas in
- följning kan slås av/på
- helskärmsläge finns

## Lokal körning

Starta en enkel webbserver i repots rot:

```bash
python -m http.server 8080
```

Öppna sedan `http://localhost:8080`.

Den inkluderade fallback-datan används lokalt. För att bygga full världstäckning lokalt behöver maskinen internetåtkomst och `unzip`:

```bash
node scripts/build-world-data.mjs
python -m http.server 8080
```

## GitHub Pages

Workflow-filen `.github/workflows/pages.yml`:

1. hämtar repot
2. kör Node 22
3. bygger världens ortregister från GeoNames
4. syntaxkontrollerar JavaScript
5. publicerar hela webbappen via GitHub Pages

Aktivera **GitHub Pages → Source: GitHub Actions** i repots inställningar första gången om Pages inte redan är aktiverat.

## Filer

- `index.html` – setup, spelvy, dialoger och semantisk UI-struktur
- `styles.css` – responsivt visuellt tema
- `data.js` – 249 ISO-landskoder, världsdelsindelning och presets
- `app.js` – spelmotor, korsningsmotor, karta och UI-tillstånd
- `place-worker.js` – global ortsökning utanför huvudtråden
- `scripts/build-world-data.mjs` – GeoNames → optimerat spelregister
- `assets/logo.svg` – Orten 2.0-logotyp
- `.github/workflows/pages.yml` – automatisk byggning/publicering

## Datakällor och licenser

- **GeoNames** – ortsdata, CC BY 4.0. Se `DATA-NOTICE.md`.
- **OpenStreetMap contributors** – kartdata/kartplattor, attribution visas av Leaflet på kartan.
- **Leaflet** – kartbibliotek.
