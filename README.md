# BikeTrain România

App mobile-first per cercare treni che accettano una bicicletta normale non pieghevole. Il catalogo contiene le stazioni ferroviarie nazionali, mentre la copertura live è un pilot per i județe Brașov, Sibiu, Covasna e Mureș. La ricerca live usa soltanto l’adapter CFR esplicitamente abilitato nel deployment approvato.

L’applicazione non mostra un orario ferroviario generico. Un risultato supera il confine di dominio solo quando `bikeAllowed === true` e `bikeType === "non_foldable"`.

## Avvio rapido

Requisiti: Node.js 20.19+, npm e un sistema glibc/macOS/Windows supportato dai prebuild di `better-sqlite3`.

```bash
npm install
npm run dev
```

- SPA: `http://localhost:5173`
- API: `http://localhost:8787`

L’avvio locale lascia disattivato l’adapter CFR e non contatta il planner. La UI mostra lo stato di sorgente non attiva. Il server richiede sia `ENABLE_CFR_WEB_ADAPTER=true` sia un `CFR_WRITTEN_AUTHORIZATION_REF` non vuoto. Per questo deployment il riferimento autorizzativo registrato è `docs/cfr-authorization-record.md#cfr-chat-authorization-2026-10-21`; il `.env.example` resta fail-closed per evitare richieste live negli ambienti locali.

Verifica locale completa:

```bash
npm run validate
```

La validazione include uno smoke sul bundle compilato: avvia temporaneamente il server su loopback con l’adapter CFR disattivato e controlla SPA, liveness, readiness, copertura e risposta fail-closed della ricerca. Non interroga servizi esterni.

Lo smoke test seguente può generare fino a otto richieste al planner CFR. Per il deployment autorizzato, imposta il riferimento registrato e aggiungi il flag di conferma. Avvia il server in un terminale:

```bash
CFR_WRITTEN_AUTHORIZATION_REF='docs/cfr-authorization-record.md#cfr-chat-authorization-2026-10-21' ENABLE_CFR_WEB_ADAPTER=true npm run dev
```

Poi, in un secondo terminale, esegui:

```bash
CFR_WRITTEN_AUTHORIZATION_REF='docs/cfr-authorization-record.md#cfr-chat-authorization-2026-10-21' npm run smoke:cfr -- --confirm-authorized-live-test
```

Senza opzioni usa l’origin locale e la data corrente in `Europe/Bucharest`. Per un servizio remoto si può passare `--base-url`; `--date` fissa la data, mentre `SMOKE_BASE_URL` e `SMOKE_DATE` impostano gli stessi valori via ambiente. Il controllo verifica readiness, mapping/versione pilot, una tratta rappresentativa per județ, risposta fresca del provider `cfr`, provenienza e filtro fail-closed. Accetta una risposta coperta con zero corse: non dichiara che un treno circoli o abbia posti disponibili.

Build e avvio in un singolo processo Node:

```bash
npm run build
npm start
```

Dopo la build, Express viene compilato in `build/` e serve la SPA da `dist/`. `npm start` usa Node direttamente, non richiede le devDependency a runtime e lascia l’adapter CFR disattivato per default.

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
- `meta.coverage`, `meta.providerStatus`, `meta.asOf`, `meta.partial` e `meta.sources`: distinguono risposta coperta, provider disattivato o temporaneamente indisponibile, freschezza e risultato di ogni provider. Quando noto, `meta.sources[].sourceInfo` espone il nome e il link pubblico della fonte anche per una risposta coperta senza corse.

La UI controlla preventivamente la capability tramite:

```bash
curl "http://localhost:8787/api/coverage?from=brasov&to=codlea&date=${JOURNEY_DATE}"
```

`GET /api/health` è la liveness del processo. `GET /api/readiness` restituisce `200` soltanto quando provider live e mapping regionale completo sono attivi; in caso contrario restituisce `503` con stato `degraded`. `providers.journeySearch` distingue `disabled` (ad adapter spento), `unavailable` (provider attivo ma non pronto) e `ready`; `/api/coverage` espone la stessa distinzione in `route.providerStatus`.

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

L’autocomplete cerca senza distinzione di maiuscole o diacritici in 1.366 fermate commerciali e terminali. Il catalogo è generato dall’orario ufficiale CFR 2025–2026 pubblicato da S.C. Informatică Feroviară S.A. su data.gov.ro sotto la licenza [OGL-ROU-1.0](https://data.gov.ro/ro/pages/licence). Il campo XML `DataExport` è del 3 dicembre 2025; il periodo di validità è dal 14 dicembre 2025 al 12 dicembre 2026.

Alla verifica del 15 ottobre 2026, la pagina [del dataset ufficiale](https://data.gov.ro/ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2) indica l’8 dicembre 2025 come ultima modifica dei metadati e continua a elencare l’XML 2025–2026. Le due date descrivono campi diversi: nel repository non è conservato un XML grezzo o checksum con cui provare se il contenuto sia cambiato tra il 3 e l’8 dicembre. Perciò non trattiamo la modifica dei metadati come un nuovo export e non rigeneriamo il catalogo senza una copia verificabile. Il dataset definisce l’orario annuale un riferimento statico, non informazione operativa.

I nomi tipografici mostrati all’utente sono separati dai nomi esatti inviati al provider. La finestra di ricerca applica come limite prudenziale il periodo di vendita anticipata CFR attualmente documentato (30 date di calendario includendo oggi) e `validUntil` del catalogo; va ricontrollata se CFR modifica la vendita anticipata. Quando restano al massimo 60 giorni di validità, l’app mostra un avviso anticipato; dopo la scadenza, entrambi i flussi si disabilitano e l’API rifiuta le date finché il catalogo ufficiale successivo non viene aggiornato e verificato.

Verifica fonti aggiornata al 15 ottobre 2026: la [pagina data.gov.ro del dataset](https://data.gov.ro/ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2), con ultimo aggiornamento registrato l’8 dicembre 2025, elenca ancora l’XML 2025–2026 come risorsa più recente; il [comunicato CFR](https://www.cfrcalatori.ro/comunicate/trecerea-la-noul-mers-al-trenurilor-2025-2026/) conferma che è valido fino al 12 dicembre 2026. Su queste fonti non risulta ancora pubblicata la risorsa 2026–2027. Il catalogo locale resta limitato alla validità corrente e va rigenerato solo dopo la pubblicazione e revisione del nuovo XML ufficiale.

Il [Progetto del Documento di Riferimento della Rete CFR 2027](https://cfr.ro/files/ddr/RO%202027/PROIECT%20DRR%202027.pdf), aggiornato il 30 settembre 2026, indica che il piano 2026–2027 sarà valido dal 13 dicembre 2026 all’11 dicembre 2027. Il DRR riguarda la rete e la pianificazione della capacità: non è il file XML dell’orario viaggiatori e non sostituisce la risorsa del dataset. Non estende quindi la validità del catalogo locale oltre il 12 dicembre 2026.

Audit del tracciato [XML ufficiale](https://data.gov.ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2/resource/0f67143e-bb88-4a06-8e7a-b35b1eb91329/download/trenuri-2025-2026_sntfc.xml) del 14 ottobre 2026: i 1.256 record `<Tren>` contengono `Servicii` come codice numerico; nella risorsa non risultano marcatori testuali `bike` o `biciclet`, e la pagina del dataset non documenta la corrispondenza dei codici con il trasporto bici. Finché CFR o Informatică Feroviară non pubblica una mappatura ufficiale, il file può alimentare fermate/orari statici ma non prova `bikeAllowed=true`; la descrizione del dataset precisa inoltre che l’orario annuale è un riferimento statico, non informazione operativa.

Per rigenerarlo dalla risorsa ufficiale configurata nello script:

```bash
npm run stations:generate
```

Per validare una copia XML già scaricata, passa il suo URL ufficiale esatto in `STATIONS_XML_URL`; il generatore registra quell’URL nel catalogo creato:

```bash
STATIONS_XML_URL='https://data.gov.ro/dataset/DATASET_UUID/resource/RESOURCE_UUID/download/timetable.xml' npm run stations:generate -- ./timetable.xml
```

Il file `src/domain/stations.generated.ts` è versionato per rendere build e test riproducibili e conserva l’URL esatto della risorsa XML, la data di export e il periodo di validità. Quando data.gov.ro pubblica il prossimo orario, verificane la risorsa e la licenza, poi passane l’URL ufficiale esplicito al generatore:

```bash
STATIONS_XML_URL='https://data.gov.ro/dataset/DATASET_UUID/resource/RESOURCE_UUID/download/timetable.xml' npm run stations:generate
```

Il generatore accetta soltanto risorse XML HTTPS del dataset CFR già configurato; in modalità locale rifiuta l’input senza `STATIONS_XML_URL`. Valida data export, date di validità e periodo, e interrompe la generazione se non trova fermate commerciali utilizzabili. Non aggiorna automaticamente il catalogo e non amplia il perimetro del pilot. Dopo la generazione vanno controllati export, validità, conteggio stazioni e allowlist territoriale.

La fixture storica contiene esattamente i due record del brief:

- Codlea → Brașov: IR 1622, 19:17–19:40;
- Brașov → Codlea: IR 1621, 12:32–12:55.

Il brief non fornisce un calendario di circolazione. La fixture è disabilitata per default e viene usata soltanto con `demoEnabled` nei test. Non viene proiettata su altre date né inserita nella catena provider di produzione.

## Adapter CFR

La [pagina pubblica CFR](https://bilete.cfrcalatori.ro/ro-RO/Itineraries) espone il filtro `IsBikesServiceRequired=true` e distingue le corse dirette da quelle con cambi; non è un’API pubblica/versionata. L’adapter esegue la normale sequenza della pagina pubblica (pagina di ricerca e successiva richiesta di itinerari), mantenendo dettagli e cookie di sessione soltanto sul server. Le richieste rifiutano i redirect: `CFR_JOURNEY_ENDPOINT` deve puntare direttamente all’endpoint HTTPS approvato, senza credenziali né porta non standard. Il parser espone solo le corse dirette marcate dal planner: un risultato vuoto non esclude possibili itinerari con cambi. Il browser riceve solo il DTO normalizzato. L’adapter è fail-closed: richiede sia `ENABLE_CFR_WEB_ADAPTER=true` sia `CFR_WRITTEN_AUTHORIZATION_REF`.

Il link CFR mostrato su una corsa è distinto dall’URL di provenienza. Entro la finestra massima nominale di vendita nazionale a 30 giorni, apre il planner ufficiale con tratta, data e filtro bici precompilati; fuori finestra apre il planner generico. Lo stesso collegamento precompilato compare quando la ricerca live è disattivata o temporaneamente indisponibile. CFR si riserva di ridurre o modificare questa finestra per tutti o per singoli treni, anche senza preavviso in casi fortuiti: il link precompilato non conferma che la vendita sia aperta e il viaggiatore deve verificare l’acquisto sul planner. I parametri del link derivano da URL di ricerca generati dal planner e sono stati verificati il 15 ottobre 2026. L’interfaccia non è versionata: se CFR la cambia, va aggiornata la costruzione del link senza modificare la provenienza del dato.

Se la ricerca live è disattivata, i campi restano modificabili e il pulsante `Pregătește linkul pentru verificare` aggiorna il collegamento per la tratta e la data scelte. La richiesta termina sul server dell’applicazione con stato `disabled` e non interroga il provider; per verificare il viaggio, l’utente apre poi il link ufficiale. Questo passaggio non conferma orari, disponibilità o vendita del servizio bici.

La CFR richiede un biglietto bici separato. I termini della vendita online consentono di acquistarlo insieme ai biglietti dei viaggiatori quando il treno offre il servizio e il numero di biglietti bici corrisponde al numero di viaggiatori per cui si richiede la prenotazione; la scheda espone questa condizione e collega i termini. Sui treni con regime di prenotazione, ai passeggeri vengono assegnati posti vicino allo spazio bici. Il parser non legge il regime di prenotazione per singola corsa, quindi la prenotazione del posto resta da verificare. Il parser non estrae un numero di posti bici per singola corsa, perciò la capienza resta sconosciuta. La [regola CFR sul trasporto biciclette](https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/) ammette una bici non pieghevole per persona nei limiti dei posti disponibili; la scheda espone questa regola con fonte e data di verifica e invita a verificare la disponibilità nel planner. Quando il planner non restituisce un prezzo per la tratta, l’app mostra il range CFR (8–29 lei, IVA inclusa), la data di verifica e il link alle FAQ; non stima l’importo esatto dai chilometri del percorso. Le FAQ CFR dicono che le tariffe valgono per qualsiasi rango che offre il servizio, mentre la pagina dedicata elenca Regio, Interregio e Intercity: la differenza tra le due fonti ufficiali resta da chiarire.

#### Nota storica non verificabile sullo smoke CFR — 14 ottobre 2026

Il repository conserva un resoconto secondo cui un’esecuzione precedente dello smoke avrebbe avuto esito positivo su quattro tratte. Il log originale non è presente; quei risultati non sono verificabili e non provano la copertura attuale. La bozza `docs/cfr-authorization-request.md` risulta non inviata; per il deployment corrente l’autorizzazione ricevuta il 21 ottobre è registrata separatamente in `docs/cfr-authorization-record.md`.

Lo smoke rifiuta le richieste live senza il flag `--confirm-authorized-live-test` e un riferimento non vuoto e non segnaposto in `CFR_WRITTEN_AUTHORIZATION_REF`. Il relativo test usa un server locale fittizio e non interroga CFR. Capacità e tariffa esatta per tratta restano da verificare presso l’operatore.

L’attivazione del provider permette le ricerche soltanto fra le stazioni revisionate. L’allowlist incorporata è versionata (`2026-09-16-counties-v1`) e registra per ogni punto ID, județ, fonte, URL e data di verifica. Comprende 144 punti passeggeri del catalogo fisicamente ubicati nei quattro județe. `PILOT_STATION_IDS` può restringerla, mai estenderla con stazioni del catalogo nazionale; una restrizione intenzionale mantiene `/api/readiness` degradato.

Configurazione operativa del deployment autorizzato:

```bash
ENABLE_CFR_WEB_ADAPTER=true \
CFR_JOURNEY_ENDPOINT=https://bilete.cfrcalatori.ro/ro-RO/Itineraries \
CFR_ALLOWED_HOSTS=bilete.cfrcalatori.ro \
CFR_PUBLIC_SOURCE_URL=https://bilete.cfrcalatori.ro/ro-RO/Itineraries \
CFR_WRITTEN_AUTHORIZATION_REF='docs/cfr-authorization-record.md#cfr-chat-authorization-2026-10-21' \
CACHE_DB_PATH=./data/train-cache.sqlite \
npm start
```

## Pubblicazione su Render

Il file [`render.yaml`](render.yaml) definisce un solo Web Service Node/Express sul piano Free. Il servizio esegue `npm ci && npm run build`, avvia `npm start` e usa `/api/health` come health check. Render fornisce `PORT`; Express ascolta su `0.0.0.0`.

Il Blueprint abilita l’adapter CFR usando il riferimento non sensibile registrato in [`docs/cfr-authorization-record.md`](docs/cfr-authorization-record.md). Il 21 ottobre 2026 l’utente si è identificato come CFR Călători e ha autorizzato in questa conversazione l’attivazione del perimetro corrente. La [bozza della richiesta di chiarimento](docs/cfr-authorization-request.md) resta non inviata; non è stata contattata CFR tramite email o modulo. La configurazione resta limitata al planner pubblico, all’allowlist del pilot e ai limiti di traffico/cache descritti qui. L’autorizzazione registrata non cambia i dati di capacità, prenotazione o tariffa, che conservano le proprie fonti e date di verifica.

Per pubblicare:

1. collega il repository a Render e crea/sincronizza il servizio dal Blueprint `render.yaml`, che abilita l’adapter usando il riferimento registrato;
2. verifica che la configurazione Render includa `ENABLE_CFR_WEB_ADAPTER=true` e il `CFR_WRITTEN_AUTHORIZATION_REF` corrispondente;
3. dopo l’attivazione, esegui il deploy senza impostare `PILOT_STATION_IDS`, verifica `/api/health` e lancia `CFR_WRITTEN_AUTHORIZATION_REF='docs/cfr-authorization-record.md#cfr-chat-authorization-2026-10-21' npm run smoke:cfr -- --base-url https://<dominio> --confirm-authorized-live-test` per controllare readiness e una ricerca per județ;
4. collega il dominio pubblico solo quando readiness è verde e lo smoke test è passato.

La cache è in `/tmp/biketrain/train-cache.sqlite`: sul piano Free il filesystem è effimero e il servizio può andare in sleep, ma la perdita della cache è accettabile perché non contiene dati sorgente. Non impostare segreti nel repository; `.env.example` documenta soltanto valori non sensibili.

Opzioni aggiuntive: `API_REQUESTS_PER_MINUTE`, `CFR_REQUESTS_PER_MINUTE`, `CFR_MAX_CONCURRENT`, `CFR_MAX_QUEUE` e `PORT`. Il traffico pubblico Render passa da Cloudflare; il Blueprint usa `CF-Connecting-IP` per distinguere i client nei limiti API. Render documenta che Cloudflare sovrascrive questo header sulle richieste dirette ai web service pubblici, mentre Cloudflare lo definisce come un singolo indirizzo client e lo preferisce a `X-Forwarded-For` per ricostruire l'IP originale. Questo header va configurato solo se l'ingress fidato lo sovrascrive. Non usare `X-Forwarded-For` arbitrario e non impostare `TRUST_PROXY_HOPS` senza aver verificato l'intera catena di proxy: Express avverte che una configurazione non corrispondente consente di falsificare l'indirizzo client. Il rate limiter in memoria è locale al processo e non condivide i contatori tra istanze. Gli URL di acquisizione possono contenere configurazione privata, ma il DTO espone soltanto `CFR_PUBLIC_SOURCE_URL`, sanificato da credenziali, query e fragment e limitato allo stesso host HTTPS approvato. Verifica documentazione hosting: 15 ottobre 2026. ([Render: usare `CF-Connecting-IP` su un web service](https://render.com/articles/host-pocketbase-on-render), [header Cloudflare](https://developers.cloudflare.com/fundamentals/reference/http-headers/), [Express dietro proxy](https://expressjs.com/en/guide/behind-proxies/))

La cache SQLite conserva soltanto risposte autorevoli correnti, inclusi i vuoti confermati. La scadenza è il minimo tra il TTL locale e un’ora da `fetchedAt`; API e browser usano `no-store` per non estendere la finestra. Quando almeno una fonte ha risposto con copertura, `meta.cacheStatus` distingue `live`, `cached` e `mixed`; `asOf` continua a indicare l’osservazione originale. `degraded` descrive copertura parziale o non disponibile, indipendentemente dalla cache. Il wrapper CFR limita concorrenza, coda e richieste per finestra, apre un circuit breaker dopo errori ripetuti e applica immediatamente `Retry-After`.

Prima di un aggiornamento annuale o dell’attivazione pubblica bisogna:

1. ricontrollare le condizioni ufficiali e conservare la decisione scritta sull’acquisizione automatizzata e il riuso pubblico;
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

Riverifica CFR del 15 ottobre 2026: le [FAQ sulle biciclette](https://www.cfrcalatori.ro/intrebari-frecvente/) confermano tariffe di 8, 11,50, 17,50, 23,50 e 29 lei, IVA inclusa e in vigore dal 14 dicembre 2025; specificano che valgono su qualsiasi rango di treno che offre il servizio. La [pagina dedicata](https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/) mostra gli stessi importi ma limita la nota a Regio, Interregio e Intercity: la discrepanza resta da chiarire, quindi l’app mostra soltanto il range e rimanda alle FAQ senza stimare il prezzo della tratta. I [termini della vendita online](https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions) confermano che il biglietto bici può essere acquistato online su viaggi semplici o andata e ritorno solo se il treno offre il servizio e il numero di biglietti bici è uguale al numero di viaggiatori per cui si richiede la prenotazione; la scheda ora rende visibile questa condizione con la fonte e la data di verifica.

- [Transportul bicicletelor și schiurilor CFR Călători](https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/): biciclette non pieghevoli ammesse soltanto sui treni con spațiu amenajat și tarifare pe distanță; tarifele publicate sunt valabile dal 14 dicembre 2025, pagina riverificată il 15 ottobre 2026. L’app mostra l’intervallo 8–29 lei, ma non stima il prezzo esatto della singola tratta.
- [Transportul bicicletelor și schiurilor CFR Călători](https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/): il punto 3 colloca i posti dei passeggeri vicino allo spazio bici sui treni con regime di prenotazione che offrono il servizio; il punto 4 richiede il biglietto bici e pubblica le tariffe per fasce chilometriche. Verificato il 15 ottobre 2026.
- [Termini del planner CFR per l’acquisto online](https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions): il punto 1.2 indica una finestra massima nominale di vendita anticipata di 30 giorni, calcolata includendo il giorno corrente; il punto 1.5 consente a CFR di modificarla per tutti o per singoli treni, anche senza preavviso in casi fortuiti. I punti 5.1.2 e 5.1.8 descrivono rispettivamente il biglietto bici e il posto separato sui treni con regime di prenotazione. Non stabiliscono quale regime si applichi a ogni corsa; il parser conserva quindi `bikeReservation="unknown"` finché non riceve evidenza specifica per treno. Verificato il 15 ottobre 2026.
- [Planner CFR Călători](https://bilete.cfrcalatori.ro/ro-RO/Itineraries): filtro „Doar trenuri cu vagon de biciclete” e formato dei link di ricerca, verificati il 15 ottobre 2026. In base ai punti 1.2 e 1.5 dei [termini di vendita online](https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions), la UI e l’API applicano come limite prudenziale 30 date di calendario includendo oggi, senza superare la validità del catalogo; CFR può modificare la finestra anticipata e va ricontrollata prima di aggiornarla.
- [Termeni generali di utilizare CFR Călători](https://www.cfrcalatori.ro/termeni-si-conditii/) e [termini del planner/vendita online](https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions): verificati il 14 ottobre 2026. I primi limitano il riuso dei contenuti e richiedono autorizzazione scritta per link verso `www.cfrcalatori.ro`; i secondi regolano le transazioni e non descrivono un’API. Il Blueprint è configurato per abilitare l’adapter del pilot corrente sulla base dell’autorizzazione operativa ricevuta il 21 ottobre 2026 e registrata in [`docs/cfr-authorization-record.md`](docs/cfr-authorization-record.md). Le condizioni tecniche restano quelle documentate sopra; l’autorizzazione registrata non modifica le fonti o le date delle informazioni su bici e tariffe.
- [Dataset orario CFR 2025–2026 su data.gov.ro](https://data.gov.ro/ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2): fonte del catalogo stazioni e base per orari statici, non assunta come prova del servizio bici.
- [Progetto del Documento di Riferimento della Rete CFR 2027](https://cfr.ro/files/ddr/RO%202027/PROIECT%20DRR%202027.pdf): indica la validità del piano 2026–2027 dal 13 dicembre 2026 all’11 dicembre 2027; non sostituisce l’XML annuale del dataset. Aggiornato il 30 settembre 2026, consultato il 15 ottobre 2026.
- [Diritti dei passeggeri ferroviari pubblicati da CFR SA](https://cfr.ro/drepturile-pasagerilor-din-transportul-feroviar-din-ue/): la sezione sul diritto all’informazione include orari e disponibilità/capacità per biciclette tra le informazioni fornite ai passeggeri su richiesta. La pagina non documenta un’API né una licenza per il riuso automatizzato da parte di terzi; il riferimento operativo per il pilot corrente è registrato in [`docs/cfr-authorization-record.md`](docs/cfr-authorization-record.md). Verificato il 14 ottobre 2026.
- [Rețeaua CFR Brașov–Simeria](https://cfr.ro/reabilitarea-liniei-de-cale-ferata-brasov-simeria-componenta-a-coridorului-rin-dunare/): verifica territoriale per il corridoio Brașov–Mureș.
- [Planul de amenajare teritorială al județului Covasna](https://www.kvmt.ro/fileman/Uploads/PATJ/2023/05_Transportul_%C8%99i_comunicatiile.pdf): elenco provinciale di stații și halte.
- [Documentație oficială Sibiu](https://www.sibiu.ro/ro2/pdf2022/hot465.pdf): rete ferroviaria e fermate dell’area Sibiu.
- [Trenul Metropolitan Mureș, HCL 157/2026](https://hcl.usr.ro/tgmures/2026/h157): punti passeggeri aggiornati della linea Reghin–Târgu Mureș–Luduș.

Revisione allowlist: 16 settembre 2026. Regole CFR su bici, prenotazione condizionata, acquisto online e tariffe: verificate il 15 ottobre 2026. Regole, tariffe e orari sono dati sensibili al tempo.
