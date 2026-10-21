# Heartbeat travelBike: piano MVP

Versione 1, 15 ottobre 2026. Questo piano consolida gli otto precedenti heartbeat. Il repository e le istruzioni correnti restano la fonte dello stato del prodotto; un run concluso non dimostra il completamento del pilot.

## Contratto

- Un solo heartbeat, nome `travelbike-mvp`, ID `4f9380f3`, sul thread persistente esistente. Non creare nuovi heartbeat, schedule, loop o agenti per aggirare una pausa o una scadenza.
- Leggere `AGENTS.md`, questo piano e `docs/heartbeat-state.md`; poi soltanto i file pertinenti. Conservare tutte le modifiche preesistenti. Nessun commit, deploy, pubblicazione o messaggio a terzi da questa automazione.
- Un solo writer. Prima di modificare file acquisire il controllo locale di idempotenza descritto sotto; se non autorizza il run, terminare senza intervenire. Non sostituire lease altrui per il solo trascorrere del tempo.
- Filtro fail-closed: `bikeAllowed === true` e `bikeType === "non_foldable"`. Pilot CFR limitato a Brașov, Sibiu, Covasna e Mureș; mantenere confine provider, provenienza e timestamp. Non inventare corse, prezzi o disponibilità.
- L’utente ha autorizzato il 21 ottobre 2026 l’attivazione dell’adapter esistente; il riferimento è in `docs/cfr-authorization-record.md`. Questo non autorizza il heartbeat a eseguire smoke live, deploy, pubblicazioni o messaggi a terzi: tali azioni richiedono una richiesta esplicita nel turno operativo. Il heartbeat resta read-only rispetto alla pubblicazione.
- Per fatti ferroviari variabili consultare fonti primarie quando si modifica il dato o quando il controllo di freschezza lo richiede. Conservare fonte, data, differenze e incertezze; non rigenerare il catalogo se non è cambiata una fonte pertinente.

## Coda finita

Verificare lo stato reale prima di iniziare: marcare una voce già dimostrata come verificata, senza rifarla. Una sola voce per run; nuove idee vanno annotate come proposte, senza estendere automaticamente il perimetro.

| ID | Attività | Prova necessaria |
| --- | --- | --- |
| TB-01 | Ricostruire il checkpoint delle modifiche MVP già presenti | Elenco compatto dei flussi realizzati, controlli pertinenti già verdi e problemi riproducibili ancora aperti. Preservare il diff dell'utente; non ripetere suite immutate. |
| TB-02 | Completare la QA visuale dei flussi locali | Screenshot mobile/desktop e interazioni: ricerca tratta, esplorazione destinazioni, ritorni espansi, cambio data/origine, modalità provider disattivato, tastiera/focus. Nessuna chiamata live a CFR. Correggere solo difetti osservati; se manca il browser, registrare `manual_pending`. |
| TB-03 | Verificare i criteri dati/provider del pilot locale | Evidenze pertinenti su filtro bici, allowlist quattro județe, provenienza/freschezza, stati disattivato/degradato e integrità del confine provider. Riutilizzare test correnti; correggere solo gap riproducibili. |
| TB-04 | Preparare la consegna locale e la decisione CFR | Un checkpoint con prove TB-01/03, esito reale TB-02, comando di verifica pertinente, limiti noti e riferimento alla bozza non inviata. Non riscrivere documenti già adeguati. |
| TB-05 | Verifica live e pubblicazione del pilot | L’autorizzazione per il perimetro corrente è registrata in `docs/cfr-authorization-record.md`; resta `waiting_external` finché la prova live e la pubblicazione non sono verificate. Il heartbeat non esegue richieste a CFR né deploy o pubblicazioni: serve un’istruzione esplicita in un turno manuale. Gli ampliamenti richiedono un nuovo riferimento autorizzativo. |

TB-01/04 chiusi non significano pilot pronto per utenti. Il completamento richiede le prove applicabili di QA, integrazione autorizzata e consegna previste dal prodotto. Non dichiarare completato il Goal soltanto per fermare l'automazione.

## Inizio e fine del run

Il messaggio Paseo contiene `run=<UUID>`. Sostituire `RUN_UUID` con quel valore, non con un UUID inventato:

```sh
/usr/local/bin/python3 "$HOME/.paseo/automation-control/launcher.py" begin --project travelbike --run RUN_UUID
```

Procedere solo con `allowed: true`. `duplicate_slot`, lease occupata, errore del controllo o run sconosciuto significano nessuna scrittura. Il controllo impedisce di ripetere la stessa scadenza anche dopo il completamento del primo tentativo.

Aggiornare `docs/heartbeat-state.md` in poche righe e chiudere la propria lease:

```sh
/usr/local/bin/python3 "$HOME/.paseo/automation-control/launcher.py" finish --project travelbike --run RUN_UUID --outcome verified --task TB-01 --evidence 'File e controlli effettivamente verificati'
```

Esiti: `progressed`, `verified`, `manual_pending`, `waiting_external`, `complete`, `error`. Task ed evidenza sono obbligatori; non inserire segreti. Per modifiche UI una verifica automatica non sostituisce una prova visuale mancante.

Se rimangono soltanto dipendenze esterne o prove umane senza lavoro indipendente, usare `waiting_external`: il controllo sospende il heartbeat, mantenendo il Goal e il prodotto nel loro stato reale. `complete` è ammesso solo con tutti i criteri provati e ferma anch'esso il heartbeat. Non ricreare l'automazione. Ripresa e rinnovo spettano all'operatore dopo il nuovo input.

Frequenza aggiornata su richiesta del proprietario il 16 ottobre 2026: ogni ora al minuto 15, 24 ore su 24 tutti i giorni, `Europe/Bucharest` (cron `15 * * * *`). Scadenza esistente invariata: 22 ottobre 2026 alle 19:08 locali; budget dei run adeguato a coprire la nuova cadenza fino a quella scadenza. I tick persi per sospensione non vanno recuperati con una raffica di run: al successivo avvio si riprende una sola voce dal checkpoint.
