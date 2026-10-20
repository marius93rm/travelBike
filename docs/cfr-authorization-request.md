# Richiesta di chiarimento a CFR Călători

**Stare:** neexpediată. Pagina CFR pentru Relații instituționale publică `RelPublic.Calatori@cfrcalatori.ro`; o considerăm o adresă candidată pentru a cere direcționarea către biroul competent, deoarece pagina nu spune că acest contact poate autoriza acces automat sau reutilizarea datelor. Acesta este un mesaj de clarificare factuală, nu o evaluare juridică.

**Destinatar candidat:** `RelPublic.Calatori@cfrcalatori.ro` — de reconfirmat înainte de trimitere.

## Messaggio proposto

**Subiect:** Solicitare de clarificare și acord scris pentru BikeTrain România

Stimată echipă CFR Călători,

Vă contactez în legătură cu BikeTrain România, un instrument independent de planificare pentru călătorii cu trenul și biciclete nepliabile. Pilotul este limitat la stații verificate din județele Brașov, Sibiu, Covasna și Mureș.

Aplicația nu vinde bilete, nu efectuează rezervări și nu solicită cont, nume sau date de plată. Pentru o căutare transmite stațiile de plecare și sosire, data, filtrul de bicicletă și câmpurile tehnice de sesiune/validare cerute de formularul public al plannerului. Rezultatele sunt normalizate și afișează numărul și categoria trenului, orele și serviciul de bicicletă indicat de filtrul plannerului, împreună cu sursa și momentul verificării; aplicația nu prezintă aceste rezultate drept locuri pentru bicicletă disponibile. Capacitatea pentru biciclete și regimul rezervării locului rămân „necunoscute” dacă răspunsul CFR nu le confirmă. Dacă se publică un tarif pe distanță, aplicația îl prezintă împreună cu sursa și data verificării.

Vă rugăm să confirmați dacă această adresă gestionează solicitări de autorizare pentru integrări terțe. Dacă nu, vă rugăm să ne indicați biroul competent sau să redirecționați mesajul.

Înainte de activarea integrării, vă rugăm să confirmați în scris:

1. Dacă CFR Călători autorizează căutări automate cu frecvență limitată prin fluxul public al plannerului `bilete.cfrcalatori.ro`, inclusiv trimiterea unei căutări cu filtrul pentru transportul bicicletelor și afișarea informațiilor normalizate descrise mai sus.
2. Dacă este permisă includerea unui link către plannerul `bilete.cfrcalatori.ro` cu stațiile, data și filtrul de bicicletă precompletate. Vă rugăm să precizați dacă cerința de autorizare pentru link-uri din termenii site-ului `www.cfrcalatori.ro` se aplică și acestui subdomeniu.
3. Ce atribuiri, limite de solicitări, perioade de cache sau alte condiții tehnice și de prezentare trebuie respectate. Configurația propusă permite cel mult 30 de căutări upstream într-o fereastră mobilă de 60 de secunde per instanță, cu maximum două căutări simultane și o coadă de cel mult 20. Cache-ul păstrează pentru maximum 60 de minute răspunsurile cu rezultat valid, inclusiv răspunsurile fără trenuri; răspunsurile de eroare nu sunt memorate. O căutare fără rezultat în cache poate genera două solicitări HTTP secvențiale către planner.
4. Dacă există un API, un flux de date sau un program de distribuție autorizat care ar trebui folosit în locul accesării fluxului public al plannerului.
5. Dacă putem prezenta regulile CFR pentru biciclete și tarifele pe zone kilometrice cu link către pagina CFR și data verificării, fără a estima un tarif exact pentru fiecare rută atunci când CFR nu îl furnizează.

Pentru claritate, catalogul de stații este construit separat din resursa anuală publicată pe data.gov.ro sub licența OGL-ROU-1.0; solicitarea de mai sus privește căutările de trasee și link-urile către plannerul CFR Călători.

Vă rugăm să indicați condițiile aplicabile și, dacă este cazul, să ne transmiteți acordul scris sau pașii necesari pentru a obține autorizarea. Integrarea va rămâne dezactivată până la primirea și revizuirea răspunsului.

Vă mulțumesc,

[Nume]<br>
[Organizație, dacă este cazul]<br>
[Adresă de e-mail de contact]<br>
[URL publică a aplicației, dacă va exista]

## Surse verificate la 14 octombrie 2026

- [Termeni și condiții generale CFR Călători](https://www.cfrcalatori.ro/termeni-si-conditii/): secțiunile privind reutilizarea conținutului și link-urile către `www.cfrcalatori.ro`.
- [Termenii plannerului online CFR](https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions): reguli despre achiziția online, inclusiv biletele pentru biciclete și schimbarea ofertei.
- [Regulile și tarifele CFR pentru biciclete nepliabile](https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/): sursa condițiilor de transport, a zonelor tarifare și a intrării lor în vigoare la 14 decembrie 2025; solicitarea întreabă separat dacă aceste informații pot fi redate în aplicație cu atribuire și data verificării.
- [Formularul oficial de contact CFR](https://www.cfrcalatori.ro/contact/).
- [Relații instituționale CFR](https://www.cfrcalatori.ro/relatii-institutionale/): pagină care publică adresa `RelPublic.Calatori@cfrcalatori.ro`; nu precizează domeniul de competență pentru aprobarea integrărilor automatizate.
- [Dataset-ul anual de mers al trenurilor CFR pe data.gov.ro](https://data.gov.ro/ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2): sursă separată pentru catalogul de stații, marcată cu licența OGL-ROU-1.0.
- [Licența deschisă data.gov.ro](https://data.gov.ro/ro/pages/licence): descrie licențele portalului; metadatele datasetului CFR indică OGL-ROU-1.0.

## Canal de contact — verificat la 15 octombrie 2026

[Pagina CFR pentru Relații instituționale](https://www.cfrcalatori.ro/relatii-institutionale/) publică adresa `RelPublic.Calatori@cfrcalatori.ro`. Este un destinatar candidat pentru a cere direcționarea solicitării, dar pagina nu precizează dacă biroul gestionează permisiuni pentru acces automat sau reutilizare. [Pagina oficială de contact CFR](https://www.cfrcalatori.ro/contact/) listează separat `presa@cfrcalatori.ro` pentru purtătorul de cuvânt și solicitările Legii 544/2001. Formularul Legii 544 este destinat informațiilor de interes public; pagina nu îl prezintă ca mecanism de autorizare. Pagina de formulare pentru propuneri/sugestii/reclamații enumeră categorii de sesizări, iar opțiunea „Diverse” afișează un formular de verificare a e-mailului; niciuna nu descrie explicit autorizarea unei integrări terțe.

Destinatarul candidat trebuie reconfirmat înainte de trimitere și nu constituie aprobare. Nu a fost trimis niciun mesaj sau formular.

## Verificare CFR actualizată la 15 octombrie 2026

La această dată au fost reverificate pagina oficială CFR despre biciclete și termenii plannerului. Tarifele pentru bicicleta nepliabilă rămân 8, 11,50, 17,50, 23,50 și 29 lei pe zonele kilometrice publicate, cu intrare în vigoare la 14 decembrie 2025. Plannerul descrie o perioadă nominală de vânzare de 30 de zile, calculată inclusiv cu ziua curentă, dar își rezervă posibilitatea să o modifice pentru toate trenurile sau punctual; serviciul de bicicletă se poate cumpăra doar când trenul îl oferă. Termenii generali ai site-ului principal au fost consultați din copia returnată de browser, indexată săptămâna precedentă; aceasta cere acord scris prealabil pentru reutilizarea comercială a conținutului și pentru link-uri către `www.cfrcalatori.ro`, iar textul trebuie reconfirmat direct înainte de expedierea cererii. Pagina și API-ul dataset-ului data.gov.ro nu au putut fi revalidate în această sesiune; păstrăm verificarea anterioară din 14 octombrie.

Această verificare nu clarifică dacă cerințele de link se aplică și subdomeniului plannerului și nu găsește o autorizare pentru căutări automate. Cererea de mai sus rămâne neexpediată, iar adapterul CFR trebuie să rămână dezactivat până la un răspuns scris sau o revizuire juridică adecvată. Nu s-a efectuat nicio solicitare live către planner în timpul acestei verificări.

### Actualizare privind sursele oficiale — 15 octombrie 2026

FAQ-ul CFR consultat astăzi spune că tarifele pentru biciclete nepliabile se aplică oricărui rang de tren care oferă serviciul, în timp ce pagina dedicată limitează nota tarifară la Regio, Interregio și Intercity. Aplicația folosește FAQ-ul ca sursă pentru interval, indică faptul că TVA este inclus și lasă diferența dintre surse nerezolvată; nu calculează un preț exact. Punctul 5.1.2 din termenii online permite cumpărarea biletului de bicicletă pentru călătorii simple sau dus-întors numai în trenurile care oferă serviciul și cu un număr de bilete de bicicletă egal cu numărul călătorilor pentru care se solicită rezervare. Regula este acum afișată în fișă cu link și dată de verificare. Poarta pentru autorizarea căutărilor automate rămâne neschimbată.

### Verificare ulterioară a catalogului de stații — 15 octombrie 2026

Verificarea ulterioară a [datasetului CFR pe data.gov.ro](https://data.gov.ro/ro/dataset/c4f71dbb-de39-49b2-b697-5b60a5f299a2) arată că resursa cea mai nouă rămâne XML-ul 2025–2026, iar metadatele indică ultima actualizare la 8 decembrie 2025. [CFR confirmă valabilitatea mersului curent până la 12 decembrie 2026](https://www.cfrcalatori.ro/comunicate/trecerea-la-noul-mers-al-trenurilor-2025-2026/); în listarea oficială consultată nu apare încă resursa 2026–2027. Această constatare actualizează nota anterioară din aceeași zi despre imposibilitatea de a revalida pagina data.gov.ro. Avertizarea din aplicație pentru ultimele 60 de zile este activă; nu se prelungește manual validitatea catalogului. Se verifică din nou sursa oficială înainte de expirare și se regenerează catalogul doar după publicarea și validarea noului XML.
