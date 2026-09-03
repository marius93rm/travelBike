# travelBike

Trova il treno giusto per partire in bici.

`travelBike` è una nuova app per pianificare viaggi in treno con la bicicletta: parte dagli orari e dalle tratte disponibili, ma mette al centro ciò che serve davvero a chi pedala — trasporto bici, cambi gestibili, tempi realistici e un percorso semplice da capire.

## Perché esiste

Organizzare un viaggio bici + treno oggi significa incrociare orari, regole diverse per ogni operatore e informazioni spesso nascoste. L’obiettivo di travelBike è trasformare questa ricerca in una decisione chiara:

> da dove parto, dove voglio arrivare, quando viaggio e che bici porto?

## Direzione del prodotto

- Cercare collegamenti ferroviari compatibili con una bici.
- Evidenziare subito trasporto bici, prenotazione e limitazioni.
- Confrontare alternative per durata, cambi e semplicità del viaggio.
- Rendere leggibile l’intero itinerario anche da mobile.
- Costruire una base solida per itinerari cicloturistici multimodali.

## Stato

Il progetto è allo stato iniziale: questa repository contiene la base documentale e operativa su cui costruire l’applicazione. Stack, provider dei dati ferroviari e modello di disponibilità bici verranno definiti insieme al primo vertical slice funzionante.

## Primo vertical slice

1. Inserimento di partenza, destinazione, data e orario.
2. Preferenza per bici pieghevole, bici intera o nessuna bici.
3. Elenco di collegamenti compatibili.
4. Dettaglio di cambi, durata, costi e condizioni per la bici.
5. Salvataggio o condivisione di un itinerario.

## Principi

- **Compatibilità prima della velocità:** un treno veloce che non accetta la bici non è una buona proposta.
- **Informazioni verificabili:** ogni vincolo importante deve avere una fonte o una data di aggiornamento.
- **Pochi passaggi:** la ricerca deve portare rapidamente a una scelta.
- **Mobile-first:** il viaggio si pianifica spesso dal telefono, anche in stazione.
- **Progressivo:** partire da un flusso utile e ampliarlo con dati e feedback reali.

## Sviluppo locale

Non è ancora presente un’app eseguibile né un package manager configurato. Quando verrà scelto lo stack, questa sezione conterrà i comandi di installazione, sviluppo, test e build.

## Contribuire

Prima di proporre una modifica:

1. descrivi il problema o il caso d’uso;
2. indica quali informazioni sul viaggio cambiano la decisione dell’utente;
3. mantieni separati dati ferroviari, logica di compatibilità e presentazione;
4. aggiungi una verifica riproducibile per ogni comportamento nuovo.

## Licenza

Da definire.
