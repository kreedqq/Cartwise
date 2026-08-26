# Manuelle Abnahme-Checkliste

Vor jeder Produktiv-Veröffentlichung (und nach größeren Änderungen) diese
Liste in einem Browser durchgehen - Desktop und mindestens ein Mobilgerät
(oder Chrome DevTools Device Toolbar).

## Auth

- [ ] Registrierung mit neuer E-Mail-Adresse funktioniert
- [ ] Bei aktivierter E-Mail-Bestätigung: Login ohne Bestätigung schlägt mit klarer Meldung fehl
- [ ] Login mit falschem Passwort zeigt eine verständliche Fehlermeldung
- [ ] Magic-Link-Anmeldung sendet eine E-Mail und meldet nach Klick an
- [ ] „Passwort vergessen" sendet eine E-Mail; der Link setzt das Passwort erfolgreich zurück
- [ ] Abmelden funktioniert und schützte Seiten sind danach nicht mehr erreichbar
- [ ] Direkter Aufruf einer geschützten URL ohne Login leitet zu `/login` um

## Warenkörbe

- [ ] Neuer Warenkorb lässt sich mit Name + optionaler Notiz erstellen
- [ ] Umbenennen funktioniert
- [ ] Duplizieren erzeugt eine vollständige Kopie inkl. aller Positionen
- [ ] „Als aktiv markieren" hebt genau einen Warenkorb hervor (Pin-Icon), ein zweites Markieren entfernt es vom vorherigen
- [ ] Archivieren ändert den Status sichtbar
- [ ] Löschen zeigt einen Bestätigungsdialog und der Warenkorb verschwindet danach
- [ ] Dashboard-Kacheln zeigen korrekte Summen (Artikelanzahl, Menge, USD, EUR)

## Artikeltabelle

- [ ] Artikelcode eingeben + Tab/Blur löst automatische Auflösung aus
- [ ] Unbekannter Code wird rot markiert mit klarer Meldung
- [ ] Deaktiviertes Produkt wird als solches markiert
- [ ] Menge 0, negativ, Text, > 100.000 werden abgelehnt, ohne die Summen zu verfälschen
- [ ] Position hinzufügen per Enter/Button funktioniert und der Fokus springt zurück
- [ ] Zeile duplizieren/löschen funktioniert
- [ ] Speicherstatus (Speichert…/Gespeichert/Fehler) erscheint bei Eingaben
- [ ] Mehrzeiliger Paste-Import: Vorschau zeigt korrekt aufgelöste/unbekannte Zeilen, nur gültige werden übernommen
- [ ] Doppelte Artikelcodes im selben Warenkorb werden als Duplikat markiert; „Zusammenführen" summiert die Menge korrekt
- [ ] Sehr breite Tabelle auf Desktop ist vollständig ohne Layoutbruch nutzbar
- [ ] Auf einem schmalen Smartphone (< 380px) wird die Karten-Ansicht angezeigt, keine abgeschnittenen Inhalte

## Summen / Sticky Bar

- [ ] Summary-Karte auf Desktop bleibt beim Scrollen sichtbar (sticky)
- [ ] Mobile Bottom-Bar zeigt USD/EUR-Summe und öffnet bei Tap die Detailansicht
- [ ] Summen aktualisieren sich sofort nach jeder Änderung, ohne Neuladen
- [ ] Fehlt der Wechselkurs, wird „Kein Wechselkurs verfügbar" angezeigt statt eines falschen EUR-Werts
- [ ] „Wechselkurs aktualisieren" lädt einen frischen Kurs und aktualisiert den Zeitstempel
- [ ] „Preise aktualisieren" zeigt eine Vorschau (alt/neu/Differenz) vor jeder Änderung

## Admin-Bereich

- [ ] Als normaler Nutzer ist `/admin` nicht sichtbar/erreichbar (Weiterleitung zu „Keine Berechtigung")
- [ ] Produkt anlegen/bearbeiten/aktivieren/deaktivieren funktioniert
- [ ] Löschen eines referenzierten Produkts wird blockiert mit Erklärung; Deaktivieren funktioniert stattdessen
- [ ] CSV-Export lädt eine gültige CSV-Datei herunter
- [ ] CSV-Import: Vorschau zeigt Fehlerzeilen, nur gültige/gewählte Zeilen werden importiert
- [ ] PDF-Import: gültige PDF mit Textlayer erzeugt eine editierbare Vorschau
- [ ] PDF-Import: gescanntes PDF ohne Textlayer zeigt den OCR-Hinweis + manuellen Text-Fallback
- [ ] Import-Historie zeigt den Import mit korrekten Zahlen (erstellt/aktualisiert/übersprungen/fehlgeschlagen)
- [ ] Benutzerübersicht zeigt alle Nutzer mit Rollen; Admin-Rolle vergeben/entziehen funktioniert
- [ ] Der letzte verbleibende Admin kann sich selbst nicht die Admin-Rolle entziehen
- [ ] Audit-Log zeigt Produkt- und Rollenänderungen mit Zeitstempel

## Fehlerfälle

- [ ] Offline schalten (DevTools „Offline"): UI zeigt einen Offline-Hinweis, keine kryptischen Fehler
- [ ] Zwei Browser-Tabs mit derselben Position: Änderung in Tab A, dann in Tab B → Tab B erhält eine Konfliktmeldung statt eines stillen Überschreibens
- [ ] Abgelaufene Session (z. B. Token in DevTools manipulieren) führt zu einer verständlichen Meldung + Redirect zum Login

## Darstellung / Zugänglichkeit

- [ ] Tastaturbedienung: Tab-Reihenfolge durch Formulare ist logisch, Fokusringe sichtbar
- [ ] Dark Mode (falls aktiviert) ist auf allen Seiten konsistent lesbar
- [ ] Farbkontraste (Text auf Badges/Buttons) sind gut lesbar
- [ ] Keine horizontalen Scrollbalken auf dem gesamten Seitenkörper (nur innerhalb von Tabellen)
