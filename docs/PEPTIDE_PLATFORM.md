# Peptid Rechner & Lexikon

Eigenständiger Wissensbereich außerhalb des Shops. Shop-Preise, Warenkorb und
Bestellung bleiben unberührt.

## Routing

- `/peptide` Landing
- `/peptide/rechner` mathematische Rechner
- `/peptide/lexikon` Suche und Filter
- `/peptide/lexikon/:slug` Substanzprofil
- `/admin/research` Connector-Health und Review-Queue

Navigation: Sidebar und Mobile-Nav unter **Rechner & Lexikon**, nicht unter Shop.

## Datengrenzen

| Shop | Lexikon |
| --- | --- |
| Produkt, SKU, Preis, Bulk, Verfügbarkeit | Substanz, Mechanismus, Studien, Quellen |
| Warenkorb / Bestellung | Identitätsprofil, Evidence, Community |

Wissenschaftliche Evidenz und Community-Daten sind getrennte Connector-Lanes.
Community darf Evidence Level nicht anheben.

Aktuelle Substanzprofile starten als **Identitätsdatensätze**.
Für den ersten Research-Batch (Retatrutide bis AOD-9604) wurden am 28.08.2026
offizielle APIs abgefragt (ClinicalTrials.gov, PubMed E-utilities, openFDA,
PubChem, EMA-EPAR-HTTP-Check). Am selben Tag lief ein Quality Audit
(`docs/RESEARCH_AUDIT_BATCH_01.md`): kuratierte Aussagen bleiben nur mit
Source-IDs veröffentlicht; fiktive/fehlzugeordnete NCT-Einträge sind nicht
mehr im published-Set. Community/Reddit bleibt unavailable.

Live-Abrufe laufen **nicht** im Browser. Rohcache: `src/research/cache/fetched/`.
Publizierte Profile: `src/lib/peptide/profiles/published.json`.

## Produktzuordnung

Shop-Artikel werden über Code-Präfixe und Namen auf Substanzen gemappt
(`src/lib/peptide/mapping.ts`). Beispiel: `RT5`–`RT40` → Retatrutide.
Blends (z. B. GHK-Cu + TB-500 + BPC-157) bleiben eigene Substance-IDs mit
Komponenten-Slugs. Preise erscheinen nicht im Lexikon.

Die Datei `GENXELL_Warenkorb_8_Kunden_FINAL(1).xlsx` liegt nicht im Repository.
Der bestehende Admin-XLSX-Import (`parseProductXlsx`) bleibt die Shop-Quelle.

## Connector

`src/research/connectors/` — einheitliche Schnittstelle `search`, `getSource`,
`getUpdates`, `normalize`, `validate`, `healthCheck`.

Wissenschaftlich: FDA, EMA, BfArM, MHRA, ClinicalTrials.gov, PubMed, Literature.
Community: Reddit, Foren, Blogs.

Live-Abrufe laufen **nicht** im Browser. Ohne serverseitige Keys/Proxy geben
Connector `unavailable` zurück. Reddit wird nicht gescrapt; Fallback:
„Reddit community data temporarily unavailable.“

## Research Engine

Pipeline in `src/research/engine.ts`. Automatische wissenschaftliche Aussagen
starten als `draft` und werden erst nach Admin-Review veröffentlicht.
Cache-Vertrag: Query, Timestamp, Content-Hash, Last Successful Request.

## Rechner

Masse: g, mg, mcg, ng. Volumen: ml. IU nur mit hinterlegter substanzspezifischer
Umrechnung — derzeit keine. Ausgabe: „Berechnetes mathematisches Ergebnis.“
Kein „Du solltest X mg verwenden.“
