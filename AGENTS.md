# Vaste randvoorwaarden voor deze app

Jos heeft expliciet live groepssessies via WebRTC geautoriseerd, met tijdelijke gegevens in het geheugen van de trainer en wissen na de sessie.

- Publiceer uitsluitend statische bestanden vanuit `dist/` via Netlify. Geen Netlify Database, Functions, Edge Functions, eigen server, API-routes, Cloudflare Workers, Next.js of Vinext.
- Behoud de gekoppelde PeerJS Cloud-verbindingsdienst. De PeerJS-browserclient mag de publieke signaling-, STUN- en TURN-diensten gebruiken. Dit is geen eigen backend en geen database. Voeg geen persoonlijke API-sleutels of servicegeheimen toe.
- Namen, antwoorden, deelnemersidentiteiten en live voortgang staan alleen in werkgeheugen. Niet in localStorage, sessionStorage, IndexedDB, bestanden, logs, analytics of externe opslag. Geen groepsgegevens naar andere deelnemers sturen; de trainer ontvangt het overzicht.
- Alleen zelfstandig oefenen mag anonieme voortgang tijdelijk in sessionStorage bewaren. Verwar dit nooit met een groepssessie.
- Een sessie krijgt een willekeurige code. De trainer start de sessie, toont QR/code, ziet live verbonden en aangemelde deelnemers, voortgang en antwoordverdeling. Deelnemers krijgen alleen hun eigen voortgang en de gedeelde nabespreking.
- Goede antwoorden, groene markeringen en percentages goed zijn bij start en vraagwisseling standaard verborgen. De trainer kan alles of een selectie bespreken. Tijdens groepsnabespreking volgen de telefoons de gekozen vraag en antwoordknop.
- Bij `Sessie afsluiten en wissen`: trainergeheugen meteen leeg; afsluitbericht naar verbonden deelnemers; hun geheugen leeg; verbindingen sluiten; oude code nooit hervatten. Onbereikbare telefoons wissen bij het verstrijken van de verlies-timeout (of bij terugkeer uit een geschorste browser). Geen absolute claim dat een offline telefoon direct op afstand gewist kan worden.
- Vernieuwen/sluiten van trainerspagina betekent verlies van de sessie. Waarschuw bij verlaten. Laat bij verbindingsproblemen de werkelijke status zien; toon antwoorden pas als ontvangen na een bevestiging van de trainer. Gebruik heartbeat, herstel en inputvalidatie.
- Behoud de 12 vragen en oorspronkelijke afbeeldingen, toelichtingen, meerkeuzevragen met meerdere juiste antwoorden, vergrootbare beelden, zelfstandig oefenen en projectieweergave.
- Behoud kant-en-klare `dist/` met relatieve paden. Netlify: build command leeg, publish `dist`, base leeg. Geen bouwstap voor Jos.
- Na bronwijzigingen: `npm run check`, `npm run build` en `npm test`. Controleer live deelname met aparte browsertabbladen indien preview beschikbaar is. Commit de gebouwde `dist/` mee.
- Werk de Nederlandse README bij bij veranderingen in gebruik of publicatie. Meld eerlijk als de externe verbinding vanuit de testomgeving niet getest kon worden. Claim geen volledige Netlify- of bedrijfsnetwerktest zonder bewijs.

