# VCH Sector Bulk — samen oefenen

Versie 4.0.0. Dezelfde statische WebRTC-werking als VCH Container Remote 4.0.0, met de twaalf Bulk-vragen en afbeeldingen uit `Bulk-12-toetsvragen-met-trainernotities aangepast.pptx`. De formulering van vraag 8 en de afbeelding bij vraag 9 zijn overgenomen.


12 oefenvragen met afbeeldingen en toelichtingen, zelfstandig oefenen en **live groepssessies zonder database of eigen serverfuncties**. Namen en antwoorden staan tijdens groepssessies alleen in het werkgeheugen van de browsers.

## Publiceren via Netlify

De complete app staat kant-en-klaar in `dist/`. Publiceer de nieuwste versie van `main` uit `JosvR/VCH-Sector-Bulk`.

| Netlify-instelling | Waarde |
| --- | --- |
| Branch | `main` |
| Base directory | Leeg (de hoofdmap `/` werkt ook) |
| Build command | Leeg |
| Publish directory | `dist` |
| Functions directory | Leeg; er zijn geen functiebestanden |
| Database / omgevingsvariabelen | Niet nodig |

Er is geen apart account of persoonlijke API-sleutel nodig voor de gekozen publieke PeerJS-verbindingsdienst. Netlify levert de website; PeerJS helpt browsers met elkaar verbinden. Een internetverbinding is nodig voor live deelname. HTTPS is nodig; Netlify regelt dat bij publicatie.

## Zo gebruikt de trainer de app

1. Open de Netlify-link met `?trainer=1`, of kies **Ik ben trainer**.
2. Klik **Start groepssessie**. Wacht tot **Groepssessie actief** verschijnt.
3. Toon de sessie-QR of deel de deelnamelink. Klik op de QR om hem groot op het scherm te zetten. Deelnemers scannen de QR en vullen hun voornaam/roepnaam in. Handmatig deelnemen kan via **Meedoen met de groep** en de 12 tekens van de sessiecode.
4. Bekijk het aantal **nu verbonden**, het totaal **deelnemers** en hoeveel er **klaar met oefenen** zijn. Een onderbroken deelnemer blijft in de lijst; ontvangen antwoorden blijven beschikbaar zolang de trainerspagina openstaat.
5. Het overzicht toont per vraag de antwoordverdeling en per deelnemer de keuzes en voortgang. Bij vragen 5 en 12 moet de deelnemer de volledige selectie opslaan.
6. Goede antwoorden, groene markeringen en percentages goed zijn standaard verborgen. Zet **Toon goede antwoorden** pas aan wanneer de groep eraan toe is.
7. Selecteer alle of enkele vragen en klik **Start nabespreking**. De telefoons volgen de gekozen vraag en de knop voor goede antwoorden. Deelnemers kunnen tijdens de nabespreking hun antwoorden niet wijzigen. Bij een volgende vraag staan goede antwoorden opnieuw uit.
8. Gebruik desgewenst **Projectieweergave**. Met **Laat de groep verder oefenen** opent u het oefenen opnieuw.
9. Klik na de les **Sessie afsluiten en wissen** en bevestig. De sessie wordt beëindigd en de namen en antwoorden verdwijnen uit het trainersscherm. Verbonden telefoons worden ook gewist en krijgen een afsluitmelding.

**Houd de trainerspagina open en voorkom de slaapstand van de laptop.** Vernieuwen of sluiten betekent verlies van de sessie. Bij verlaten vraagt de browser waar mogelijk om bevestiging. De sessie is niet terug te halen. Start vervolgens een nieuwe sessie met een nieuwe QR.

De sessie-QR geldt alleen voor die ene les. Gebruik in de PowerPoint de vaste trainerlink; laat de trainer de actuele deelnemers-QR vanuit de app tonen. Een opgeslagen sessie-QR werkt na afsluiten niet meer.

## Deelnemers

- Scan de sessie-QR, vul je naam in en kies **Meedoen**. Gebruik geen e-mailadres of andere persoonsgegevens.
- Werk op je eigen tempo. Bij een enkele keuze wordt het antwoord meteen verstuurd. Bij meerdere juiste antwoorden klik je **Antwoorden opslaan**.
- **Keuze ontvangen door de trainer** verschijnt pas na ontvangstbevestiging. Bij een onderbreking toont de app dat; opgeslagen keuzes blijven tijdelijk in het geheugen. Houd de pagina open voor automatisch herstel.
- Kies na de 12 vragen **Ik ben klaar**. Wacht op de gezamenlijke nabespreking. In een groepssessie blijven goede antwoorden verborgen totdat de trainer ze toont.
- Bij afsluiten worden de tijdelijke groepsgegevens gewist. Een telefoon die offline is kan geen afsluitbericht ontvangen; deze wist zijn gegevens na circa 60 seconden zonder trainercontact. Als de browser door de telefoon is geschorst, wordt dit bij hervatten verwerkt. Dit is geen gegarandeerde onmiddellijke wissing van een offline apparaat.
- Vernieuwen of sluiten van de deelnemerspagina wist de lokale deelname. Na opnieuw aansluiten verschijnt deze als nieuwe deelnemer. Gebruik daarom dezelfde pagina zolang de les duurt.

## Zelfstandig oefenen

**Zelf oefenen** werkt zonder live verbinding. Na 12 antwoorden zie je je eigen score en toelichtingen en kun je onjuiste vragen opnieuw oefenen. Alleen deze anonieme voortgang wordt tijdelijk in sessionStorage van het eigen tabblad bewaard (maximaal acht uur). Deze antwoorden worden niet doorgestuurd naar een trainer. De QR voor zelfstandig oefenen op de startpagina is dus anders dan de sessie-QR.

## Hoe de tijdelijke verbinding werkt

- De app gebruikt de ingebouwde WebRTC-datachannels van de browser met de gebundelde **PeerJS 1.5.5**-client.
- De publieke **PeerJS Cloud** (`0.peerjs.com`, beveiligd via HTTPS/WebSocket) regelt de verbindingsopbouw. De configuratie gebruikt Google STUN en PeerJS TURN als doorgeleiding nodig is, inclusief een TCP-poging wanneer UDP geblokkeerd is. De publieke TURN-inloggegevens die al in PeerJS zitten zijn geen persoonlijke geheimen.
- Antwoorden gaan via versleutelde WebRTC-verbindingen naar de trainersbrowser; eventueel via een TURN-doorverbinding. Er is geen applicatiedatabase, resultaatbestand of eigen server. Signaling/relaydiensten kunnen netwerkmetadata verwerken; de app schrijft daar geen deelnemerslijsten of antwoordoverzichten naar weg.
- De trainer bewaart het groepsgeheugen. Deelnemers ontvangen alleen hun eigen voortgang en de actuele nabespreking, geen namen/antwoorden van anderen. Een ontvangstbevestiging voorkomt een onterechte melding dat een antwoord bij de trainer binnen is.
- Iedere nieuwe sessie krijgt een willekeurige code met 12 tekens; de QR zet deze in het URL-fragment. Codes worden niet hergebruikt. Er zijn geen accounts of persoonlijke API-sleutels.
- Heartbeats herkennen weggevallen verbindingen. Binnen een nog geopende pagina probeert de app dezelfde deelnemer opnieuw te verbinden en bewaart de trainer de ontvangen antwoorden. Deelnemers wissen hun geheugen als de trainer langdurig onbereikbaar is. De maximale sessieduur is acht uur.
- De gedeelde gratis PeerJS Cloud heeft geen beschikbaarheidsgarantie. Bedrijfswifi/firewalls kunnen WebRTC of de dienst blokkeren. Test vooraf een trainer en twee telefoons op de daadwerkelijke locatie; probeer bij blokkade een toegestaan ander netwerk. De app toont verbindingsproblemen; hij doet dan niet alsof de live ontvangst werkt.
- De code begrenst sessies op 80 aangemelde deelnemers. Dit is een beveiligingslimiet, geen geteste capaciteit of garantie voor die groepsgrootte. Kleine tekstberichten gebruiken weinig data; werkelijke capaciteit hangt af van browser, laptop, netwerk en publieke verbindingsdienst.

Bronnen: [PeerJS starten](https://peerjs.com/client/getting-started), [PeerJS Cloud](https://peerjs.com/server/cloud), [PeerJS FAQ](https://peerjs.com/client/faq). Dit is een formatieve oefentoets, geen beveiligde examenbank; de antwoordmodellen zijn onderdeel van de statische app.

## Ontwikkeling en volgende wijzigingen

| Bestand | Doel |
| --- | --- |
| `dist/` | Complete direct te publiceren website |
| `src/questions.json` | 12 vragen, antwoordmodellen en beelden |
| `src/learning-app.tsx` | Startpagina, zelfstandig oefenen en trainerweergave |
| `src/question-view.tsx` | Gedeelde vraagweergave met vergrootbare afbeeldingen |
| `src/live-session.ts` | WebRTC-sessies, ontvangstbevestiging, herstel en wissen |
| `src/live-protocol.mjs` | Codes, payloadvalidatie, timeouts en antwoordverdeling |
| `src/live-trainer.tsx` | Sessie-QR, live overzicht en deelnemerslijst |
| `src/live-learner.tsx` | Aanmelden en oefenen met de groep |
| `AGENTS.md` | Te behouden architectuur en privacyafspraken |

Voor de ontwikkelaar: `npm ci`, `npm run check`, `npm run build`, `npm test`. Commit ook de opnieuw gebouwde `dist/`. De tests controleren onder andere 12 antwoorden, meerdere juiste antwoorden, twee deelnemers, live ontvangst, verborgen antwoorden, nabespreking, verkeerde payloads, herstel en wissen van een offline deelnemer. Browsercontrole met de echte verbindingsdienst blijft nodig voor netwerkgedrag.

## Verificatie van deze wijziging (1 november 2026)

TypeScript-controle, productiebuild en de tests voor toetsinhoud, tijdelijke sessies, twee deelnemers, ontvangen antwoorden, nabespreking, verbindingsherstel, inputvalidatie en wissen zijn geslaagd. De schermindeling en sessie-QR zijn in de browser gecontroleerd. De publieke signaling-dienst wordt vanuit de testbrowser bereikt, maar een echte WebRTC-gegevensverbinding tussen de browsertabbladen is daar niet tot stand gekomen. De live werking is dus nog niet bevestigd op Netlify of met echte telefoons. De geautomatiseerde sessietests gebruiken een gesimuleerd transport; dat bewijst geen bereikbaarheid door een bedrijfsnetwerk.

Controleer na Netlify-publicatie met een trainer en twee telefoons: beide namen zichtbaar, 2 verbonden, een antwoord zichtbaar in de tabel, meervoudige antwoorden opslaan, nabespreking volgen, antwoorden tonen/verbergen, volgende vraag weer verborgen, en afsluiten/wissen op alle verbonden schermen.

