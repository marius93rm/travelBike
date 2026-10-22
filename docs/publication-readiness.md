# Verifica di preparazione alla pubblicazione

Stato verificato il 22 ottobre 2026. Questa verifica confronta il repository con la configurazione Render attuale, le fonti ufficiali CFR e le indicazioni aggiornate delle piattaforme. È una lista operativa, non un parere legale né una prova di un deployment pubblico.

## Risultato

**Non considerare ancora l’app pronta per una pubblicazione rivolta al pubblico.** Sono stati chiusi alcuni controlli ripetibili nel repository, ma restano bloccanti la verifica degli advisory dipendenze, la scelta di un hosting adatto alla produzione, l’informativa privacy completa e una prova sul deployment effettivo.

## Implementato nel repository

- `.node-version` ora fissa Node.js `24.22.1`; `package.json` ammette solo le linee LTS 22 e 24 e ne esclude Node 20, ormai fuori supporto. La versione è allineata al [rilascio di sicurezza Node del 21 ottobre](https://github.com/nodejs/node/releases) e al [default Render documentato](https://render.com/docs/node-version) al 22 ottobre.
- Aggiunta CI su push e pull request verso `main`, con permessi GitHub minimi, azioni fissate a SHA, installazione da lockfile e `npm run validate`.
- Configurati aggiornamenti Dependabot settimanali per npm e GitHub Actions.
- Rafforzati gli header HTTP senza introdurre dipendenze: `form-action 'self'`, `Permissions-Policy` e HSTS nei processi con `NODE_ENV=production`. `render.yaml` imposta la modalità di produzione solo nel comando di avvio, così la build continua a installare le devDependency. I test dello smoke compilato controllano gli header pubblici.

## Blocchi prima del lancio

### Dipendenze

`npm audit` sul lockfile iniziale segnala 9 advisory: 2 moderate, 4 high e 3 critical. Due riguardano dipendenze di produzione: `proxy-addr` (critical) e `undici` (high). La correzione automatica del lockfile non è riuscita in questo ambiente: npm ha rifiutato il download di un pacchetto opzionale con `EALLOWREMOTE`. Non considerare risolti questi advisory finché un aggiornamento del lockfile non passa `npm audit` e `npm ci` in un ambiente che consente i download npm.

### Hosting e URL pubblico

`render.yaml` configura un Web Service Render Free e scrive la cache SQLite in `/tmp`. Render [sconsiglia il piano Free per la produzione](https://render.com/docs/free): i servizi si arrestano dopo 15 minuti senza traffico, impiegano circa un minuto a riavviarsi e perdono i file locali quando si arrestano, riavviano o ridistribuiscono. La perdita della cache non altera l’orario sorgente, ma il cold start e l’assenza di persistenza rendono questa configurazione inadatta a un servizio pubblico affidabile. Scegliere un piano/host prima del lancio; qui non è stata fatta una scelta che comporti costi. Render assegna comunque un sottodominio `onrender.com` e [TLS gestito](https://render.com/docs/tls), quindi un dominio personalizzato non è obbligatorio per una prima pubblicazione di prova.

Non esiste ancora un servizio pubblico da provare: dopo aver scelto l’host eseguire lo smoke sul suo URL, verificare TLS, health/readiness, ricerca, tempi di risposta, log e variabili CFR.

### Informativa privacy e flussi dati

Il frontend non ha account, analytics, cookie propri né storage browser. Invia al backend criteri di tratta e data; con l’adapter attivo il server interroga il planner CFR. Il server legge un IP per il rate limiting, scrive nei log metodo, percorso senza query string, stato, durata e request ID, e conserva le risposte riuscite nella cache SQLite per un massimo di un’ora. Ho aggiunto una pulizia periodica dei record scaduti ogni cinque minuti e una pulizia all’avvio/arresto; dopo un’interruzione non ordinata, record già scaduti possono restare sul filesystem fino al riavvio o alla successiva pulizia. La configurazione Render Free usa storage effimero; anche i log e le eventuali copie lato provider di hosting vanno verificati prima di pubblicare.

Nel repository non sono indicati l’identità legale del titolare del trattamento, un contatto privacy, la base giuridica, gli eventuali destinatari/responsabili, la regione e conservazione dei log dell’host, o una politica completa di conservazione e cancellazione. L’[art. 13 GDPR](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679) richiede tra le altre cose identità/contatti del titolare, finalità e base giuridica quando i dati sono raccolti. Non pubblicare un testo segnaposto: questi dati devono essere forniti e approvati prima di scrivere l’informativa definitiva.

La base di codice non usa al momento analytics o cookie non essenziali; non aggiungere un banner di consenso per strumenti che non sono installati. Ricontrollare questa conclusione se vengono aggiunti SDK, analytics o storage lato browser.

### Accessibilità e ambito normativo

La UI contiene landmark semantici, link per saltare al contenuto, etichette e stati annunciati; serve ancora una verifica manuale con tastiera, zoom, contrasto e almeno uno screen reader sulle schermate e sugli stati reali. Usare [WCAG 2.2](https://www.w3.org/TR/WCAG22/) come riferimento tecnico di qualità.

La [Legge rumena 232/2022](https://legislatie.just.ro/Public/FormaPrintabila/00000G31VWSBZXR3OXU1NHF8OA0PUC7L) è in vigore dal 28 giugno 2025 e comprende elementi di servizi di trasporto ferroviario e fornitura di informazioni ai passeggeri, con eccezioni per i servizi regionali. Il prodotto è un pilot informativo indipendente, non vende biglietti; la sua classificazione rispetto alla legge e l’eventuale applicabilità delle regole e-commerce dipendono dal servizio effettivamente offerto e vanno determinate prima del lancio. La [definizione di e-commerce della direttiva](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32019L0882) richiede anche una finalità di conclusione di un contratto col consumatore. La repo non può stabilire da sola tale classificazione.

### Validità e verifica operativa dei dati

Il catalogo stazioni locale è estratto dall’orario CFR 2025–2026, valido fino al 12 dicembre 2026; l’app rifiuta le date fuori dalla finestra del catalogo invece di mostrare dati scaduti. Il [comunicato CFR sul calendario 2025–2026](https://www.cfrcalatori.ro/comunicate/trecerea-la-noul-mers-al-trenurilor-2025-2026/) conferma la validità fino al 12 dicembre; al controllo del 22 ottobre, la pagina del dataset e la sua API non erano accessibili, quindi non è verificata una risorsa 2026–2027. Prima che scada il catalogo, controllare la [pubblicazione ufficiale](https://data.gov.ro/ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2) e rigenerare/rivedere catalogo e allowlist. Il test sul planner CFR è già stato eseguito localmente entro il perimetro autorizzato, ma non sostituisce la prova sul deployment.

## Checklist di lancio

- [ ] Eseguire in un ambiente con download npm consentiti `npm audit fix`, ispezionare il lockfile aggiornato, poi passare `npm audit`, `npm ci` e `npm run validate`.
- [ ] Verificare la prima esecuzione della CI su GitHub e proteggere `main` con il controllo `CI / Validate on Node 24 LTS`.
- [ ] Scegliere e configurare un hosting di produzione adatto; non usare il piano Render Free corrente per il servizio pubblico.
- [ ] Definire titolare, contatto, finalità, base giuridica, retention, hosting/log, destinatari e responsabilità; pubblicare l’informativa prima di raccogliere dati dagli utenti.
- [ ] Completare la verifica manuale WCAG 2.2 sui flussi di ricerca, errori, caricamento e navigazione mobile.
- [ ] Verificare che il catalogo ufficiale successivo sia disponibile e aggiornare prima del 12 dicembre 2026.
- [ ] Dopo il deploy, provare URL pubblico, TLS, health/readiness, ricerca CFR, accessibilità, log e comportamento a freddo senza superare i limiti del pilot autorizzato.
