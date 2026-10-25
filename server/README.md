# Orten – beständig spelserver

Servern kontrollerar varje drag med V3:s befintliga spelmotor och serverns verifierade GeoNames-register. Mobilerna skickar bara ort-id, drag-id och senast kända revision. SQLite sparar match och behandlade drag i samma transaktion innan svaret skickas. Varken värdens mobil eller en PeerJS-förbindelse behövs för att bevara en match.

## Körning

Node 24 krävs. Från repots rot:

```sh
node scripts/build-world-data.mjs
node server/index.mjs
```

Öppna http://localhost:8080. Servern levererar både webbappen och API:t på samma adress. Databasen ligger normalt i `server/var/rooms.sqlite`; välj beständig plats med `ORTEN_DB_PATH`. Port styrs med `PORT` (8080 som standard). Servern vägrar starta med ofullständig eller felaktig ortdata.

Container:

```sh
docker compose -f server/compose.yml up --build -d
```

Compose binder till localhost:8080. Lägg en HTTPS-proxy framför tjänsten för telefoner och internet. Proxy måste vidarebefordra ursprungligt Host; ange inga publika URL:er eller nycklar i klientkoden. Webbläsarens säkra kontext krävs för ortdatans SHA-256-kontroll. Volymen `orten-data` måste bevaras vid omstart/uppdatering. Kör en instans med lokal beständig disk; detta är inte en stateless/serverless-tjänst. Ta SQLite-konsistenta säkerhetskopior, inklusive WAL eller via SQLite backup, innan uppdatering.

## Spelarflöde

- Två spelare skapar/ansluter med rumskod. Värden väljer Klassisk/Duell och länder.
- Servern sparar start, inställningar och varje godkänt drag.
- Förbindelsen hämtar uppdaterat tillstånd varje sekund (HTTP-pollning, lämpligt för detta turbaserade spel).
- Tappade drag skickas igen med samma id. Servern räknar dem en gång även efter omstart.
- Båda spelarna får en hemlig återanslutningsnyckel; servern lagrar bara dess hash. Nyckeln sparas lokalt i webbläsaren, aldrig i delningslänken.
- Efter omladdning: välj **Fortsätt sparad onlinematch**. Återanslutning till samma rumskod använder också den sparade identiteten.
- Att lämna sidan/rummet stänger inte matchen för den andre. Rummet löper ut efter sju dagars inaktivitet. En ny match ersätter den enda sparade återanslutningsgenvägen på den enheten.
- Om webbläsardata raderas eller en annan enhet används finns ingen kontoåterställning i denna version.

## Befintlig webbplats

GitHub Pages fortsätter använda PeerJS; filen `v3/server-config.js` är där tom. Node-servern levererar samma sökväg dynamiskt med `/api` aktiverat. Det finns ingen tyst återgång till PeerJS vid ett serverfel. För serverläget öppnar spelarna den nya HTTPS-adressen, inte GitHub Pages-adressen.

Den här leveransen är server och ansluten webbklient, inte en Android-APK. Samma API kan användas av en framtida Android-klient. Ingen extern server har provisionerats. Kartplattor och Leaflet laddas fortfarande externt. Befintliga lokala matchjournaler påverkas inte; servermatcher sparas som återupptagbart matchläge men förs ännu inte över till den lokala replaylistan.

## API

- `POST /api/rooms`: `{code,name,mode,countries}` → snapshot + hemlig token.
- `POST /api/rooms/:code/join`: `{name}` → snapshot + token.
- `GET /api/rooms/:code/state`: senaste matchläge och spelare.
- `POST /api/rooms/:code/settings`: `{mode?,countries?}`, endast värden före start.
- `POST /api/rooms/:code/start`: `{}`, endast värden; upprepad start återställer inte spelet.
- `POST /api/rooms/:code/move`: `{placeId,moveId,revision}`.

Alla anrop utom create/join kräver `Authorization: Bearer <token>`. API:t tillåter webbanrop från samma origin. Storleksgräns 8 KiB per anrop, 600 anrop/minut per anslutande IP, 20 nya rum/minut per IP, högst 10 000 aktiva rum och 5 000 drag/match. Bakom proxy delas IP-gränsen; dimensionera denna vid större drift. Servern exponerar inte databas, källkod i servermappen eller tokens i snapshots.

## Verifiering

```sh
npm --prefix server test
npm --prefix v3 test
```

Tester använder riktig HTTP, SQLite på disk och separata klientidentiteter. De täcker serveromstart, värdens omladdning, förlorade svar, väntande drag över sidomladdning, dubbla drag, fel tur, falska koordinater, spärrad åtkomst, landsval, slutläge och utgångna rum. Fysisk tvåmobiltestning, HTTPS-driftsättning och belastningstest återstår före publik drift.
