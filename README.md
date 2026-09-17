# BikeTrain România

App mobile-first per cercare treni che accettano una bicicletta normale non pieghevole. Il catalogo contiene le stazioni ferroviarie nazionali, mentre la copertura live è un pilot per i județe Brașov, Sibiu, Covasna e Mureș. La ricerca live usa soltanto l’adapter CFR esplicitamente abilitato nel deployment approvato.

L’applicazione non mostra un orario ferroviario generico. Un risultato supera il confine di dominio solo quando `bikeAllowed === true` e `bikeType === "non_foldable"`.

## Avvio rapido

Requisiti: Node.js 20.19+, npm e un sistema glibc/macOS/Windows supportato dai prebuild di `better-sqlite3`.

```bash
npm install
ENABLE_CFR_WEB_ADAPTER=true npm run dev
```

- SPA: `http://localhost:5173`
- API: `http://localhost:8787`

Verifica locale completa:

```bash
npm run validate
```

Build e avvio in un singolo processo Node:

```bash
npm run build
ENABLE_CFR_WEB_ADAPTER=true npm start
```

Dopo la build, Express viene compilato in `build/` e serve la SPA da `dist/`. `npm start` usa Node direttamente e non richiede le devDependency a runtime.

## API interna

```bash
JOURNEY_DATE=$(TZ=Europe/Bucharest date +%F)
curl "http://localhost:8787/api/trains?from=cfr-20658&to=brasov&date=${JOURNEY_DATE}&bike=true"
```

`bike=true` è obbligatorio. Gli ID stazione provengono dal catalogo locale (per esempio `cfr-20658` è Sibiu; `codlea` e `brasov` conservano gli ID storici del prototipo). Stazioni sconosciute, stazioni identiche, date non ISO e tentativi di disattivare il filtro bici restituiscono `400`.

Una risposta vuota è sempre qualificata da `meta.coverage`:

- `covered`: la fonte ha risposto autorevolmente e non ha trovato treni compatibili;
- `unsupported`: la tratta o la capability non appartiene al pilot;
- `unavailable`, `rate_limited` o `invalid_payload`: la fonte non può fornire una risposta attuale.

La risposta include:

- `options`: treni normalizzati compatibili con biciclette non pieghevoli;
- `meta.reliability`: `official`, `open_data` o `fallback`;
- `meta.degraded` e `meta.warning`: indicano una risposta parziale, non coperta o temporaneamente indisponibile.
- `meta.coverage`, `meta.asOf`, `meta.partial` e `meta.sources`: distinguono copertura, freschezza e risultato di ogni provider.

La UI controlla preventivamente la capability tramite:

```bash
curl "http://localhost:8787/api/coverage?from=brasov&to=codlea&date=${JOURNEY_DATE}"
```

`GET /api/health` è la liveness del processo. `GET /api/readiness` restituisce `200` soltanto quando provider live e mapping regionale completo sono attivi; in caso contrario restituisce `503` con stato `degraded`.

La modalità esplora usa un endpoint separato e impone esplicitamente treni diretti:

```bash
curl "http://localhost:8787/api/destinations?from=brasov&date=${JOURNEY_DATE}&bike=true&direct=true"
```

La risposta raggruppa per destinazione `departures` e `returns`. Il servizio accetta soltanto coppie con `changes === 0`, bici non pieghevole confermata e almeno un ritorno successivo all’arrivo della prima andata.

## Architettura dati

```text
React SPA
  ├─ GET /api/trains
  │    └─ TrainSearchService (filtro bike-only definitivo)
  └─ GET /api/destinations
       └─ DestinationDiscoveryService (bike-only + changes === 0)
            └─ provider con capacità discoverDirectDestinations
```

Il browser non interroga né analizza CFR/Infofer. Il frontend conosce solo il DTO dell’API. Tutti i dettagli HTML e i parametri specifici dell’operatore rimangono nell’adapter server-side.

## Modalità “Unde pot ajunge?”

L’utente seleziona soltanto stazione e data di partenza. I risultati mostrano destinazione, prima andata diretta verificata, primo ritorno diretto successivo e il numero di eventuali altri ritorni. Da ogni scheda si può aprire la coppia nella ricerca classica.

La discovery è una capacità opzionale, separata dalla ricerca punto-punto per evitare fan-out di centinaia di richieste. In produzione resta `unsupported` finché non esiste uno snapshot orari affidabile unito a evidenza positiva per il trasporto bici. La fixture Brașov → Codlea → Brașov del 3 settembre 2026 resta disponibile soltanto nei test e non rappresenta copertura live.

## Catalogo stazioni

L’autocomplete cerca senza distinzione di maiuscole o diacritici in 1.366 fermate commerciali e terminali. Il catalogo è generato dall’orario ufficiale CFR 2025–2026 pubblicato da S.C. Informatică Feroviară S.A. su data.gov.ro con licenza OGL-ROU-1.0 (export 3 dicembre 2025, valido dal 14 dicembre 2025 al 12 dicembre 2026). I nomi tipografici mostrati all’utente sono separati dai nomi esatti inviati al provider. La finestra di ricerca è sempre il minimo tra 120 giorni da oggi e `validUntil` del catalogo.

Per rigenerarlo dalla risorsa ufficiale configurata nello script:

```bash
npm run stations:generate
```

Il file `src/domain/stations.generated.ts` è versionato per rendere build e test riproducibili. Alla pubblicazione del prossimo orario annuale va aggiornato l’URL della risorsa in `scripts/generate-stations.mjs`, rigenerato il file e verificata la validità del catalogo.

La fixture storica contiene esattamente i due record del brief:

- Codlea → Brașov: IR 1622, 19:17–19:40;
- Brașov → Codlea: IR 1621, 12:32–12:55.

Il brief non fornisce un calendario di circolazione. La fixture è disabilitata per default e viene usata soltanto con `demoEnabled` nei test. Non viene proiettata su altre date né inserita nella catena provider di produzione.

## Adapter CFR

La pagina pubblica CFR espone il filtro `IsBikesServiceRequired=true`, ma non è un’API pubblica/versionata. L’adapter esegue la normale sequenza della pagina pubblica (pagina di ricerca e successiva richiesta di itinerari), mantenendo dettagli e cookie di sessione soltanto sul server. Il browser riceve solo il DTO normalizzato. L’adapter è fail-closed: senza il valore esplicito `true` non viene effettuata alcuna chiamata CFR.

```bash
ENABLE_CFR_WEB_ADAPTER=true npm run dev
```

L’attivazione del provider permette le ricerche soltanto fra le stazioni revisionate. L’allowlist incorporata è versionata (`2026-09-16-counties-v1`) e registra per ogni punto ID, județ, fonte, URL e data di verifica. Comprende 144 punti passeggeri del catalogo fisicamente ubicati nei quattro județe. `PILOT_STATION_IDS` può restringerla, mai estenderla con stazioni del catalogo nazionale; una restrizione intenzionale mantiene `/api/readiness` degradato.

Configurazione operativa:

```bash
ENABLE_CFR_WEB_ADAPTER=true \
CFR_JOURNEY_ENDPOINT=https://bilete.cfrcalatori.ro/ro-RO/Itineraries \
CFR_ALLOWED_HOSTS=bilete.cfrcalatori.ro \
CFR_PUBLIC_SOURCE_URL=https://bilete.cfrcalatori.ro/ro-RO/Itineraries \
CACHE_DB_PATH=./data/train-cache.sqlite \
npm start
```

## Pubblicazione su Render

Il file [`render.yaml`](render.yaml) definisce un solo Web Service Node/Express sul piano Free. Il servizio esegue `npm ci && npm run build`, avvia `npm start` e usa `/api/health` come health check. Render fornisce `PORT`; Express ascolta su `0.0.0.0`.

Per pubblicare:

1. collega il repository a Render e crea il servizio dal Blueprint `render.yaml`;
2. esegui il primo deploy senza impostare `PILOT_STATION_IDS`;
3. verifica `/api/health` (liveness), `/api/readiness` (mapping e provider) e una ricerca per ciascun județ;
4. se readiness è verde, collega il dominio pubblico al servizio.

La cache è in `/tmp/biketrain/train-cache.sqlite`: sul piano Free il filesystem è effimero e il servizio può andare in sleep, ma la perdita della cache è accettabile perché non contiene dati sorgente. Non impostare segreti nel repository; `.env.example` documenta soltanto valori non sensibili.

Opzioni aggiuntive: `API_REQUESTS_PER_MINUTE`, `CFR_REQUESTS_PER_MINUTE`, `CFR_MAX_CONCURRENT`, `CFR_MAX_QUEUE` e `PORT`. Dietro un reverse proxy noto, `TRUST_PROXY_HOPS` abilita esplicitamente il numero di hop fidati; senza questa impostazione Express non si fida degli header client. Gli URL di acquisizione possono contenere configurazione privata, ma il DTO espone soltanto `CFR_PUBLIC_SOURCE_URL`, sanificato da credenziali, query e fragment e limitato allo stesso host HTTPS approvato.

La cache SQLite conserva soltanto risposte autorevoli correnti, inclusi i vuoti confermati. La scadenza è il minimo tra il TTL locale e un’ora da `fetchedAt`; API e browser usano `no-store` per non estendere la finestra. Il wrapper CFR limita concorrenza, coda e richieste per finestra, apre un circuit breaker dopo errori ripetuti e applica immediatamente `Retry-After`.

Prima di un aggiornamento annuale bisogna:

1. verificare condizioni legali e tecniche;
2. validare la sequenza pagina di ricerca + richiesta itinerari e i selettori del parser;
3. rigenerare il catalogo e aggiornare l’allowlist solo dopo la revisione provinciale;
4. eseguire lo smoke test sullo stesso runtime del deployment.

Il provider non risolve CAPTCHA, autenticazione o blocchi anti-bot. Un markup non riconosciuto, un body non HTML/troppo grande o dati scaduti producono uno stato indisponibile invece di dichiarare un falso risultato vuoto.

## Evoluzione prevista

L’orario statico e la capacità bici sono due livelli separati:

- un futuro import dell’orario XML popolerà corse e fermate, riutilizzando gli stessi codici stazione;
- adapter per operatore arricchiranno soltanto le corse con evidenza bici;
- nessun treno entrerà nei risultati senza evidenza positiva per una bici non pieghevole.

Questo confine consente di aggiungere Regio Călători, Transferoviar, Softrans, Astra Trans Carpatic e Interregional senza cambiare la UI o il servizio di ricerca.

## Fonti ufficiali verificate

- [Întrebări frecvente CFR Călători](https://www.cfrcalatori.ro/intrebari-frecvente/): regola per biciclette non pieghevoli e tariffa 1–60 km di 8 lei.
- [Planner CFR Călători](https://bilete.cfrcalatori.ro/ro-RO/Itineraries): filtro „Doar trenuri cu vagon de biciclete”.
- [Dataset orario CFR 2025–2026 su data.gov.ro](https://data.gov.ro/ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2): fonte del catalogo stazioni e base per orari statici, non assunta come prova del servizio bici.
- [Rețeaua CFR Brașov–Simeria](https://cfr.ro/reabilitarea-liniei-de-cale-ferata-brasov-simeria-componenta-a-coridorului-rin-dunare/): verifica territoriale per il corridoio Brașov–Mureș.
- [Planul de amenajare teritorială al județului Covasna](https://www.kvmt.ro/fileman/Uploads/PATJ/2023/05_Transportul_%C8%99i_comunicatiile.pdf): elenco provinciale di stații și halte.
- [Documentație oficială Sibiu](https://www.sibiu.ro/ro2/pdf2022/hot465.pdf): rete ferroviaria e fermate dell’area Sibiu.
- [Trenul Metropolitan Mureș, HCL 157/2026](https://hcl.usr.ro/tgmures/2026/h157): punti passeggeri aggiornati della linea Reghin–Târgu Mureș–Luduș.

Ultimo controllo delle fonti e revisione allowlist: 16 settembre 2026. Regole, tariffe e orari sono dati sensibili al tempo.
