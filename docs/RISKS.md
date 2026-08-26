# Umsetzungsrisiken & bekannte Grenzen

Diese Liste wird bewusst zusätzlich zur Kurzfassung in `KONZEPT.md` geführt,
damit Betreiber sie vor dem Produktivbetrieb einzeln abhaken können.

## Fachliche Risiken

1. **PDF-Parsing ist heuristisch.** Unterschiedliche Lieferanten-PDFs (Spalten
   vs. Freitext, mehrzeilige Namen, Tausendertrennzeichen, verschiedene
   Währungssymbole) können falsch oder gar nicht erkannt werden.
   *Gegenmaßnahme:* verpflichtende, editierbare Vorschau; nichts wird ohne
   Admin-Bestätigung übernommen; unsichere Zeilen werden farblich markiert.
   *Restrisiko:* Admin muss Vorschau tatsächlich prüfen — UI erzwingt das
   Scrollen/Sichten nicht technisch, sondern durch klare Kennzeichnung.
2. **Kein OCR.** Gescannte PDFs ohne Textlayer liefern keine automatischen
   Daten. *Gegenmaßnahme:* Erkennung + CSV-/Text-Fallback. *Restrisiko:*
   manueller Mehraufwand bei Scans.
3. **Wechselkurs-Volatilität.** EZB-Referenzkurse werden nur einmal täglich
   aktualisiert (an Bankarbeitstagen); für Sekunden-genaue Handelskurse
   ungeeignet. *Einschätzung:* für interne Bestelllisten ausreichend; im
   Dokument transparent gemacht (Zeitstempel wird immer angezeigt).
4. **Duplikat-Strategie (A3).** Bewusst keine automatische Zusammenführung —
   kann bei sehr großen Importen/Warenkörben zu unübersichtlich vielen
   Duplikat-Zeilen führen. *Gegenmaßnahme:* Duplikat-Banner mit Ein-Klick-Merge.
5. **Sehr große Warenkörbe (>1000 Positionen).** Die Tabelle ist nicht
   virtualisiert; bei sehr großen Mengen kann die Render-Performance im
   Browser sinken. *Empfehlung für v2:* `@tanstack/react-virtual` ergänzen,
   sobald reale Nutzungszahlen das rechtfertigen (bewusst nicht vorgezogen,
   um Komplexität gering zu halten, wo sie nicht gebraucht wird).

## Technische/Betriebsrisiken

6. **GitHub Pages liefert eine SPA aus.** Ohne serverseitiges Rewriting
   führen Deep-Links (`/carts/123`) bei direktem Aufruf zu 404, wenn nicht
   ein `404.html`-Fallback (SPA-Redirect-Trick) eingerichtet ist.
   *Umsetzung:* `public/404.html` + Redirect-Skript ist Teil des Projekts.
7. **Supabase-Freemium-Limits** (Requests, Storage, Edge-Function-Aufrufe)
   können bei hoher Last erreicht werden. *Empfehlung:* Monitoring im
   Supabase-Dashboard vor Produktivstart aktivieren.
8. **CORS/Redirect-URLs.** Auth-Redirects (Passwort-Reset, Magic Link)
   müssen für jede Domain (lokal, GitHub Pages) in Supabase konfiguriert
   werden — sonst schlägt der Flow mit einer unklaren Fehlermeldung fehl.
   *Dokumentiert in:* `README.md` Abschnitt "Redirect-URLs".
9. **Abhängigkeit von Frankfurter API.** Kein SLA-Vertrag; Ausfallrisiko ist
   real, aber durch Cache/Fallback (siehe `KONZEPT.md` §6) abgefedert.
10. **Bleeding-Edge-Paketversionen.** Das Scaffold nutzt aktuelle Major-
    Versionen (React 19, Vite 8, TypeScript 6, Vitest 4, Tailwind 3.4). Diese
    wurden gegen den mitgelieferten Code gebaut und getestet (siehe
    Verifikationsschritt in README), sollten aber vor Produktivbetrieb
    erneut mit `npm outdated`/`npm audit` geprüft werden, da sich das
    Ökosystem schnell weiterentwickelt.

## Nicht umgesetzt (bewusst, mit Begründung)

- **OCR-Texterkennung** für gescannte PDFs (siehe Annahme A6).
- **Mehrsprachigkeit / i18n-Framework** (nicht gefordert; UI ist auf Deutsch
  fest verdrahtet, Strings sind aber zentral genug gehalten, um später ein
  i18n-Layer nachzuziehen).
- **Zahlungs-/Checkout-Integration** (nicht gefordert, siehe Annahme A9).
- **Tabellen-Virtualisierung** für extrem große Warenkörbe (siehe Punkt 5).
- **Automatisiertes E2E-Test-Setup (Playwright) im CI**: Unit-/Komponententests
  sind vorhanden und laufen in CI; ein vollständiger E2E-Lauf gegen eine
  echte Supabase-Instanz erfordert Secrets/Testprojekt und wird als manueller
  Schritt in `docs/MANUAL_QA_CHECKLIST.md` beschrieben statt im CI erzwungen
  (vermeidet brüchige CI-Läufe gegen einen externen Dienst ohne dediziertes
  Testprojekt).
