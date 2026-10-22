# Report di prodotto e prontezza alla pubblicazione

**Data della verifica:** 22 ottobre 2026<br>
**Perimetro:** interfaccia e flusso cliente, con riepilogo dei blocchi tecnici già verificati in [docs/publication-readiness.md](docs/publication-readiness.md).<br>
**Prova UI:** app locale, browser Paseo, viewport mobile 390 × 844 px; per visualizzare la scheda treno è stata usata una risposta di prova isolata nel browser. L’adapter live CFR è disattivato in locale e non sono state fatte richieste live. Le osservazioni iniziali qui sotto descrivono lo stato prima degli interventi UX; gli esiti aggiornati sono riportati nella sezione dedicata.

## Giudizio rapido

BikeTrain ha una proposta chiara e un buon livello di prudenza sui dati: cerca treni diretti, mostra solo il trasporto bici confermato e distingue esplicitamente l’accettazione della bici dalla disponibilità dei posti. Il flusso è comprensibile e si adatta al telefono.

Lo considererei **un pilot promettente, non ancora un servizio pubblico pronto**. Gli interventi UX hanno tolto la tratta dimostrativa, mostrano la copertura prima della ricerca e nascondono le destinazioni quando il servizio non è supportato. La ricerca live resta non verificabile nell’ambiente locale fail-closed; rimangono inoltre i blocchi tecnici e operativi indicati nella verifica di pubblicazione.

## La prova iniziale dello zio che cerca una tratta

1. **Atterra sulla pagina.** Vede una tratta già selezionata, la data corrente e risultati già richiesti. Non è detto che capisca che Codlea → Brașov è solo un esempio. Meglio iniziare con i campi da compilare, oppure etichettare chiaramente la tratta dimostrativa e richiedere un’azione esplicita.
2. **Compila le stazioni.** L’autocomplete è etichettato, restituisce suggerimenti e comunica quanti ne ha trovati. Nel controllo manuale “Sibiu” ha prodotto suggerimenti pertinenti. Il pulsante per invertire la direzione è presente e accessibile.
3. **Capisce il perimetro.** La pagina dice che è un pilot e che cerca solo treni diretti con servizio bici confermato. La copertura per Brașov, Sibiu, Covasna e Mureș si scopre però dopo aver selezionato una tratta non coperta. Conviene dirlo vicino al modulo prima della ricerca, con indicazione semplice delle aree supportate.
4. **Vuole esplorare senza sapere la destinazione.** La scheda “Unde pot ajunge?” sembra promettere una funzione centrale, ma mostra subito che l’esplorazione non è disponibile nel pilot. È trasparente, ma la scheda invita a un percorso che non può completare: va nascosta finché non funziona, oppure marcata come non ancora disponibile direttamente sull’etichetta.
5. **Interpreta un risultato.** Le informazioni su treno, orari, tariffa, fonte e verifica sono solide. È particolarmente corretta la distinzione tra “bicicletta accettata” e “posti disponibili sconosciuti”. Per un cliente, però, la scheda contiene molti dettagli e il passo successivo è sparso tra note e link. Portare in alto un riepilogo breve — bici ammessa, disponibilità da verificare, prezzo/condizione e pulsante CFR — renderebbe la decisione più immediata.
6. **Cerca per più persone o bici.** Il modulo non chiede il numero di viaggiatori o biciclette. Se il pilot copre solo una persona con una bici, va detto vicino alla ricerca; se si vogliono aiutare gruppi, serve modellare quantità e regole di prenotazione prima di suggerire che un treno vada bene per tutti.

## Aggiornamento UX implementato

- La pagina ora si apre con partenza e destinazione vuote e senza avviare una ricerca treni. Il controllo della copertura parte quando c’è una stazione di partenza; la ricerca della tratta parte solo dopo il clic su “Caută trenuri”.
- Le quattro contee servite dal pilot sono indicate sopra il modulo.
- Il percorso condivisibile usa partenza, arrivo e data nell’URL; il link iniziale viene ripristinato al caricamento e il comando di condivisione usa il menu del dispositivo o la copia negli appunti.
- La scheda destinazioni compare solo dopo una risposta di copertura utilizzabile o temporaneamente non disponibile. Se il backend locale la dichiara non supportata, la scheda non appare.
- La scheda treno mette nello stesso riepilogo bici accettata, capacità, supplemento e azione per verificare/acquistare presso l’operatore. L’azione è prima delle note estese di prenotazione; il testo chiarisce che la disponibilità va verificata sul sito dell’operatore.
- I risultati diretti sono ordinati per istante di partenza; il filtro offre tutti gli orari o le partenze dalle 10:00, 14:00 e 18:00, calcolati nel fuso rumeno. Il conteggio si aggiorna e, se il filtro non trova treni, si può ripristinare l’elenco completo. Il filtro è locale e non avvia un’altra richiesta al provider.
- Nei risultati è esplicito che la ricerca non verifica i posti residui e che i gruppi devono controllare presso l’operatore i posti per tutti e un biglietto bici per ogni bicicletta.
- Quando il catalogo stazioni è scaduto, la pagina spiega il blocco e non avvia richieste.
- Non sono state aggiunte animazioni decorative, mappa o widget generici: non risolvono il dubbio principale sulla possibilità di trasportare la bici.

Per il pilot abbiamo scelto di non chiedere il numero di viaggiatori o biciclette: le API non verificano i posti residui per una quantità e le regole dipendono dall’operatore. La ricerca conferma il servizio bici sul treno, non la disponibilità per una persona o un gruppo.

## Cosa funziona già bene

- Il linguaggio promette solo ciò che i dati possono sostenere: le coincidenze sono escluse e la capacità è “sconosciuta” quando la fonte non la pubblica.
- Sono presenti data, intervallo di ricerca, stazioni accessibili da tastiera, inversione del percorso e stati distinti per errore, copertura non supportata, provider disattivato e risultati vuoti.
- Le schede mostrano provenienza e verifica, mentre le avvertenze ricordano che BikeTrain non vende biglietti.
- A 390 px il modulo si dispone in una colonna e i controlli principali restano facili da toccare. Il codice include focus visibile, skip link, annunci degli aggiornamenti e rispetto di `prefers-reduced-motion`.
- La modalità locale disattivata non inventa risultati: propone il collegamento all’operatore. È comportamento corretto per sviluppo e fallback.

## Cosa aggiungere, in ordine di valore

### Priorità 1 — stato delle proposte

- **Completato — ingresso senza tratta implicita:** campi vuoti, nessuna richiesta di treni automatica e ricerca esplicita al clic.
- **Completato — copertura visibile prima della ricerca:** indicazione delle quattro contee sopra il modulo.
- **Completato — riepilogo scheda risultato:** bici ammessa, disponibilità/capacità, supplemento e verifica presso l’operatore sono raccolti prima delle note estese di prenotazione. Un costo viene mostrato come importo solo quando ha una fonte di supporto.
- **Decisione pilot — gruppi:** nessun selettore quantità finché l’API non può verificare la disponibilità richiesta. La pagina avvisa i gruppi di controllare posti e biglietti presso l’operatore. Verifica CFR del 22 ottobre 2026: FAQ “una bicicletta per persona”; per l’acquisto online i biglietti bici devono corrispondere ai viaggiatori per cui si richiede la prenotazione ([FAQ CFR](https://www.cfrcalatori.ro/intrebari-frecvente/), [termini bilete online, §5.1.2](https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions)).
- **Completato — condivisione della ricerca:** URL con stazioni e data; considerare che questi criteri possono finire nella cronologia o essere condivisi.

### Priorità 2 — ridurre attrito per chi torna

- **Completato — ricerche recenti:** massimo quattro tratte in memoria solo per la visita corrente; si possono ripetere, eliminare singolarmente o cancellare tutte. La cronologia scompare al ricaricamento della pagina, non viene salvata sul dispositivo né inviata come elenco. Una ricerca ripetuta usa la normale richiesta di ricerca.
- **Completato — orario di partenza:** ordinamento cronologico e soglie dalle 10:00, 14:00 e 18:00, interpretate nel fuso rumeno. Il filtro mostra quante corse restano e offre il ripristino dell’elenco se non ci sono corrispondenze.
- **Completato — guida acquisto:** la scheda CFR collega alla guida ufficiale per comprare online, accanto alla regola sul biglietto bici. La verifica dei posti resta sul sito dell’operatore.

### Animazioni e widget

Non aggiungerei animazioni decorative o un widget generico: non aiutano a capire se la bici può salire. Lo spinner e le transizioni già presenti bastano; il rispetto del movimento ridotto è già previsto. Se il caricamento reale risultasse lungo, aggiungere uno stato progressivo testuale o scheletri leggeri, evitando di far sembrare già confermato un risultato.

Una mappa non è prioritaria per questo compito: può far pensare che l’intero paese sia coperto anche quando la verifica è limitata. È più utile mostrare chiaramente la copertura effettiva e il collegamento al provider. Notifiche su posti o cambi di orario vanno considerate solo quando esiste una fonte affidabile che li aggiorna.

## Prontezza alla pubblicazione: blocchi già individuati

Questi punti provengono dalla verifica tecnica e documentale già svolta, riassunta in [docs/publication-readiness.md](docs/publication-readiness.md):

1. **Dipendenze:** `npm audit` ha segnalato 9 advisory, inclusi problemi critici/alti in dipendenze di produzione. La correzione automatica non è andata a buon fine in quell’ambiente; serve risolvere e verificare con `npm audit`, `npm ci` e `npm run validate`.
2. **Hosting:** la configurazione Render Free non è adatta a un servizio pubblico affidabile per sospensione, riavvio lento e filesystem effimero. Va scelto un hosting adatto; un dominio personalizzato non è necessario per un primo test perché Render fornisce URL e TLS.
3. **Privacy:** mancano titolare, contatto, finalità, base giuridica, destinatari e informazioni complete su retention/log dell’host. L’app non usa analytics o account; la ricerca invia tratta e data al backend e, quando abilitato, al provider CFR. Non pubblicare un’informativa fittizia.
4. **Prova di deployment e accessibilità:** non c’è ancora un URL pubblico da provare. Restano da verificare sul deployment la ricerca live, TLS, avvio a freddo e log; è ancora necessaria una verifica manuale con tastiera, zoom e screen reader.
5. **Scadenza catalogo:** il catalogo stazioni CFR 2025–2026 è valido fino al **12 dicembre 2026**. Al controllo precedente non era verificato un catalogo 2026–2027. Va individuato e controllato quello nuovo prima della scadenza.
6. **Perimetro normativo:** la possibile applicabilità della normativa rumena sull’accessibilità dipende dal servizio effettivamente pubblicato e va determinata sul prodotto reale, non assunta dal repository.

Fonti di riferimento già raccolte nella verifica: [GDPR, art. 13](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Legge rumena 232/2022](https://legislatie.just.ro/Public/FormaPrintabila/00000G31VWSBZXR3OXU1NHF8OA0PUC7L), [validità orario CFR 2025–2026](https://www.cfrcalatori.ro/comunicate/trecerea-la-noul-mers-al-trenurilor-2025-2026/), [indicazioni Render Free](https://render.com/docs/free), [FAQ CFR sulle biciclette](https://www.cfrcalatori.ro/intrebari-frecvente/) e [termini d’acquisto CFR online](https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions).

## Esito della verifica manuale

- Riaperta la UI locale a 390 × 844 px: campi vuoti, copertura visibile e scheda destinazioni non mostrata prima della verifica.
- Scheda treno controllata a 390 × 844 px con una risposta locale di prova: bici, capacità sconosciuta, supplemento da verificare e azione CFR si leggono in sequenza; il pulsante è a larghezza piena e precede le note estese.
- Filtro orario controllato nel browser Paseo a 390 × 844 px con tre partenze di prova in ordine casuale: i risultati sono mostrati cronologicamente; “De la 10:00” lascia le partenze delle 10:00 e delle 18:00 e annuncia “2 din 3 trenuri afișate”. La risposta era simulata nel browser; nessuna richiesta live CFR.
- Ricerche recenti viste nel browser Paseo a 390 × 844 px dopo il cambio di tratta: percorso, data, ripetizione, rimozione e cancellazione totale hanno controlli chiari; la nota dichiara che i dati spariscono al ricaricamento. L’adapter live CFR era disattivato.
- Il testo per i gruppi è presente nei risultati; non viene mostrata una disponibilità quantitativa che il backend non fornisce.
- I test confermano che la pagina iniziale non invia richieste; una ricerca valida aggiorna l’URL e un link diretto ripristina i criteri.
- In locale l’adapter live è disattivato: compare il messaggio corretto e il link a CFR. **Questo controllo non dimostra che la ricerca pubblica live funzioni**, perché non esiste ancora un deployment pubblico da verificare.
- `npm run validate` completato dopo le ricerche recenti: lint superato, 212 test superati, build di produzione riuscita e smoke del server compilato superato (SPA, health, readiness, coverage e ricerca fail-closed).

## Prossimo passo consigliato

La prova con utenti è stata completata, come confermato dall’utente. Con ricerche recenti e filtro orario, il passo UX successivo è osservare come le persone scelgono le corse e verificare dove il flusso resta poco chiaro. Un eventuale selettore quantità richiederà dati di capacità specifici per tratta e regole provider; prima della pubblicazione restano inoltre i blocchi tecnici e operativi sopra elencati.
