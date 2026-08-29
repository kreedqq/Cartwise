import { bp } from "@/lib/peptide/lexiconV2/contentEngine/benefits/format";
import type { BenefitsProfile } from "@/lib/peptide/lexiconV2/contentEngine/benefits/types";

export const ORAL_BENEFITS: Record<string, BenefitsProfile> = {
  finasteride: bp("finasteride", {
    w: [
      "Hemmung der 5α-Reduktase und Senkung von DHT in zugelassenen Indikationen.",
      "Bei benigner Prostatahyperplasie: Reduktion der Prostatavolumina und Verbesserung der Miktionsparameter.",
      "Bei androgenetischer Alopezie: Hemmung des Haarausfalls und teilweise Haarverdichtung in Studien.",
    ],
  }),
  sildenafil: bp("sildenafil", {
    w: [
      "Verbesserung der erektilen Funktion bei erektiler Dysfunktion in RCTs.",
      "Bei pulmonaler arterieller Hypertonie: Verbesserung der Belastbarkeit und hämodynamischer Parameter (je nach Produkt).",
    ],
  }),
  tadalafil: bp("tadalafil", {
    w: [
      "Verbesserung der erektilen Funktion bei erektiler Dysfunktion.",
      "Bei pulmonaler arterieller Hypertonie: Verbesserung der Belastbarkeit (je nach Produkt).",
      "Bei benignem Prostatahyperplasie-Syndrom: Verbesserung der Miktionsbeschwerden (je nach Produkt).",
    ],
  }),
  minoxidil: bp("minoxidil", {
    w: [
      "Systemisch: Blutdrucksenkung bei therapierefraktärer Hypertonie (je nach Produkt).",
      "Topisch: Förderung des Haarwachstums bei androgenetischer Alopezie in zugelassenen Formulierungen.",
    ],
  }),
  tamoxifen: bp("tamoxifen", {
    w: [
      "Reduktion des Rezidivrisikos bei hormonrezeptor-positivem Mammakarzinom in adjuvanten Studien.",
      "Therapeutische Wirksamkeit bei metastasiertem Mammakarzinom in etablierten Schemas.",
    ],
  }),
  letrozole: bp("letrozole", {
    w: [
      "Reduktion des Östrogenspiegels durch Aromatasehemmung bei postmenopausalem Mammakarzinom.",
      "In adjuvanten Studien: Reduktion des Rezidivrisikos gegenüber Tamoxifen in bestimmten Populationen.",
    ],
  }),
  anastrozole: bp("anastrozole", {
    w: [
      "Reduktion des Östrogenspiegels durch Aromatasehemmung bei postmenopausalem Mammakarzinom.",
      "In adjuvanten Studien: Reduktion des Rezidivrisikos.",
    ],
  }),
  exemestane: bp("exemestane", {
    w: [
      "Irreversible Aromatasehemmung bei postmenopausalem Mammakarzinom.",
      "In Studien: Reduktion des Rezidivrisikos nach Tamoxifen-Therapie.",
    ],
  }),
  dutasteride: bp("dutasteride", {
    w: [
      "Hemmung von Typ-1- und Typ-2-5α-Reduktase; stärkere DHT-Senkung als Finasterid.",
      "Bei benigner Prostatahyperplasie: Reduktion der Prostatavolumina und Verbesserung der Miktionsparameter.",
    ],
  }),
  oxandrolone: bp("oxandrolone", {
    w: [
      "In zugelassener Indikation (Gewichtsverlust nach Operation/Trauma): Förderung der Gewichtszunahme und Erhalt der Magermasse.",
    ],
    p: [
      "Anabole Effekte auf Muskelmasse und Körperzusammensetzung in Studien – nur für die zugelassene Indikation relevant.",
    ],
  }),
  ivermectin: bp("ivermectin", {
    w: [
      "In zugelassenen Indikationen: Wirksamkeit gegen parasitäre Infektionen (z. B. Onchozerkose, Strongyloidiasis, Skabies je nach Produkt).",
    ],
  }),
  clomiphene: bp("clomiphene", {
    w: [
      "Ovulationsinduktion bei bestimmten Formen der weiblichen Unfruchtbarkeit durch Stimulation der FSH/LH-Freisetzung.",
    ],
    p: [
      "In Studien bei männlichem Hypogonadismus wurden Effekte auf Testosteronspiegel und Spermatogenese untersucht – nicht überall zugelassen.",
    ],
  }),
  cabergoline: bp("cabergoline", {
    w: [
      "Senkung des Prolaktinspiegels bei Hyperprolaktinämie.",
      "Bei Parkinson: Dopamin-Agonismus und Verbesserung motorischer Symptome (je nach Produkt).",
    ],
  }),
  dapoxetine: bp("dapoxetine", {
    w: [
      "Verlängerung der intravaginalen Ejakulationslatenzzeit bei vorzeitigem Samenerguss in RCTs (in zugelassenen Märkten).",
    ],
  }),
  clenbuterol: bp("clenbuterol", {
    w: [
      "In zugelassenen Indikationen: bronchodilatatorische Wirkung bei obstruktiven Atemwegserkrankungen.",
    ],
    c: [
      "In präklinischen Modellen wurden Effekte auf Muskelmasse und Fettstoffwechsel beschrieben – keine etablierte Humantherapie dafür.",
    ],
  }),
  t3: bp("t3", {
    w: [
      "Normalisierung des Stoffwechsels und klinischer Symptome bei Hypothyreose.",
      "Schnellere Wirkung als T4 durch direkte T3-Aktivität.",
    ],
  }),
  t4: bp("t4", {
    w: [
      "Normalisierung des Stoffwechsels und klinischer Symptome bei Hypothyreose und Schilddrüsenunterfunktion.",
    ],
  }),
  prednisone: bp("prednisone", {
    w: [
      "Potente antiinflammatorische und immunsuppressive Wirkung in zugelassenen Indikationen (z. B. Autoimmunerkrankungen, allergische Reaktionen, Entzündungen).",
    ],
  }),
  isotretinoin: bp("isotretinoin", {
    w: [
      "In schwerer Akne: deutliche Reduktion der Läsionen und langfristige Remission in RCTs.",
    ],
    p: [
      "Reduktion der Talgproduktion und normalisierte Keratinisierung der Haarfollikel.",
    ],
  }),
  hydroxychloroquine: bp("hydroxychloroquine", {
    w: [
      "In zugelassenen Indikationen (z. B. Malaria-Prophylaxe, Rheumatoide Arthritis, Lupus): antiinflammatorische und immunmodulierende Wirkung.",
    ],
  }),
  telmisartan: bp("telmisartan", {
    w: [
      "Blutdrucksenkung als AT1-Rezeptor-Blocker in Hypertonie.",
      "In Studien: kardiovaskuläre Risikoreduktion in bestimmten Populationen.",
    ],
  }),
  salbutamol: bp("salbutamol", {
    w: [
      "Schnelle bronchodilatatorische Wirkung bei Asthma und COPD (Symptom-lindernd).",
    ],
  }),
  enclomiphene: bp("enclomiphene", {
    p: [
      "Als trans-Isomer des Clomifens: Stimulation der LH/FSH-Freisetzung und Erhöhung der Testosteronproduktion in Studien bei männlichem Hypogonadismus.",
    ],
    c: [
      "Selektiver Östrogenrezeptor-Modulator (SERM) – Effekte auf die hypothalamisch-hypophysär-gonadale Achse in präklinischen Modellen.",
    ],
  }),
  fluoxymesterone: bp("fluoxymesterone", {
    w: [
      "Historisch: Behandlung von Androgenmangel und bestimmten Anämieformen (je nach Region).",
    ],
    p: [
      "Anabole/androgene Effekte auf Muskelmasse und Erythropoese in medizinischen Kontexten – heute selten eingesetzt.",
    ],
  }),
  oxymetholone: bp("oxymetholone", {
    w: [
      "In zugelassener Indikation (Anämie): Stimulation der Erythropoese.",
    ],
    p: [
      "Anabole Effekte auf Muskelmasse in medizinischen Studien – nur für die zugelassene Indikation relevant.",
    ],
  }),
  mesterolone: bp("mesterolone", {
    p: [
      "Androgenrezeptor-Agonismus und Erhöhung der freien Testosteronfraktion durch SHBG-Bindung in Studien.",
      "In einigen Regionen für Androgenmangel und Unfruchtbarkeit eingesetzt.",
    ],
  }),
  "stanozolol-oral": bp("stanozolol-oral", {
    w: [
      "In zugelassener Indikation (hereditäres Angioödem): Reduktion der Häufigkeit und Schwere von Angioödem-Anfällen.",
    ],
    p: [
      "Anabole Effekte auf Muskelmasse in medizinischen Kontexten – Missbrauch birgt erhebliche Risiken.",
    ],
  }),
  tesofensine: bp("tesofensine", {
    p: [
      "In Phase-2-Studien bei Adipositas: signifikante Gewichtsreduktion gegenüber Placebo.",
      "Als triple Monoamin-Wiederaufnahmehemmer: Effekte auf Appetit und Energieverwertung.",
    ],
  }),
  ostarine: bp("ostarine", {
    p: [
      "In Phase-2-Studien bei Sarkopenie und Krebs-assoziierter Kachexie: Erhalt bzw. Zunahme der Magermasse.",
      "In gesunden Männern: Zunahme der Magermasse in kontrollierten Studien.",
    ],
    c: [
      "Selektive Androgenrezeptor-Modulation mit anaboler Wirkung auf Muskel und Knochen in präklinischen Modellen.",
    ],
  }),
  ligandrol: bp("ligandrol", {
    p: [
      "In Phase-1/2-Studien: Zunahme der Magermasse bei gesunden Erwachsenen und bei Sarkopenie.",
    ],
    c: [
      "Anabole Effekte auf Muskelgewebe mit reduzierter Androgenisierung in Tiermodellen.",
    ],
  }),
  rad140: bp("rad140", {
    p: [
      "In Phase-1-Studien: Zunahme der Magermasse bei gesunden Erwachsenen.",
    ],
    c: [
      "In präklinischen Modellen: anabole Effekte auf Muskel und Knochen mit geringerer Prostatabeeinflussung als Testosteron.",
    ],
  }),
  andarine: bp("andarine", {
    c: [
      "In präklinischen Modellen: anabole Effekte auf Muskel und Knochen (S-4/GTX-007).",
      "In Tierstudien: Verbesserung der Knochendichte und Magermasse.",
    ],
    p: [
      "Humane Studien sind begrenzt; keine Zulassung als Humanarzneimittel.",
    ],
  }),
  yk11: bp("yk11", {
    c: [
      "In präklinischen Modellen: Myostatin-Hemmung und anabole Effekte auf Muskelzellen.",
      "In Zellstudien: Förderung der Muskelzelldifferenzierung.",
    ],
  }),
  cardarine: bp("cardarine", {
    c: [
      "In präklinischen Modellen: Aktivierung von PPARδ mit Effekten auf Fettsäureoxidation und Ausdauer.",
      "In Tierstudien: verbesserte Ausdauerleistung und veränderte Körperzusammensetzung.",
    ],
    p: [
      "In frühen Humanstudien wurden metabolische Effekte untersucht – Entwicklung wegen Tumorbedenken in Tierstudien gestoppt.",
    ],
  }),
  aicar: bp("aicar", {
    c: [
      "In präklinischen Modellen: AMPK-Aktivierung mit Effekten auf Glukosestoffwechsel und Ausdauer.",
      "In Tierstudien: verbesserte Insulinsensitivität und Ausdauerleistung.",
    ],
    p: [
      "In Humanstudien wurden Effekte auf Glukosestoffwechsel untersucht – keine zugelassene Humantherapie.",
    ],
  }),
  sr9009: bp("sr9009", {
    c: [
      "In präklinischen Modellen: REV-ERB-Agonismus mit Effekten auf zirkadianen Rhythmus und Stoffwechsel.",
      "In Tierstudien: verbesserte Ausdauer und reduzierte Adipositas.",
    ],
  }),
  bam15: bp("bam15", {
    c: [
      "In präklinischen Modellen: mitochondriale Entkopplung mit Erhöhung des Energieverbrauchs.",
      "In Tierstudien: Reduktion von Körpergewicht und Verbesserung des Glukosestoffwechsels ohne Muskelverlust.",
    ],
  }),
  dnp: bp("dnp", {
    c: [
      "Historisch: mitochondriale Entkopplung mit massiver Erhöhung des Grundumsatzes in präklinischen Modellen.",
    ],
    note:
      "DNP wurde historisch als Diät-Hilfsmittel verwendet, ist aber wegen schwerer Toxizität (Hyperthermie, Tod) nicht als Humanarzneimittel zugelassen. Positiver Effekt auf Gewichtsverlust steht in keinem Verhältnis zum Risiko.",
  }),
  "methylene-blue": bp("methylene-blue", {
    w: [
      "Als Methylenblau: Behandlung von Methämoglobinämie (zugelassen).",
    ],
    p: [
      "In Studien bei kognitiver Beeinträchtigung und neurodegenerativen Erkrankungen wurden Effekte untersucht – nicht breit etabliert.",
    ],
    c: [
      "In präklinischen Modellen: mitochondriale Funktion und neuroprotektive Effekte.",
    ],
  }),
  dianabol: bp("dianabol", {
    p: [
      "Historisch: anabole Effekte auf Muskelmasse und Kraft in medizinischen Studien (Methandrostenolon).",
    ],
    c: [
      "Androgenrezeptor-Agonismus und anabole Wirkung auf Skelettmuskulatur in präklinischen Modellen.",
    ],
    note: "Dianabol (Methandrostenolon) ist kein zugelassenes Humanarzneimittel in den meisten Märkten. Historische medizinische Anwendungen ersetzen keine aktuelle Zulassung.",
  }),
  turinabol: bp("turinabol", {
    p: [
      "Historisch (DDR-Sportmedizin): anabole Effekte auf Muskelmasse und Leistungsfähigkeit dokumentiert.",
    ],
    c: [
      "Chlor-substituiertes Methandrostenolon-Derivat mit anaboler Wirkung in präklinischen Modellen.",
    ],
    note: "Chlordehydromethyltestosteron ist kein zugelassenes Humanarzneimittel.",
  }),
  metribolone: bp("metribolone", {
    c: [
      "In präklinischen Modellen: sehr potenter Androgenrezeptor-Agonist (Methyltrienolon/R1881).",
      "In Forschung: Referenz-Androgen für Rezeptor-Bindungsstudien.",
    ],
    note: "Metribolon ist ein Forschungssteroid ohne Humantherapie-Zulassung – extrem hepatotoxisch.",
  }),
  methylstenbolone: bp("methylstenbolone", {
    c: [
      "In präklinischen Modellen: anabole Effekte auf Muskelmasse als Designer-Steroid.",
    ],
    note: "Methylstenbolon ist kein zugelassenes Humanarzneimittel; FDA-Warnungen zu Designer-Steroiden.",
  }),
  methasterone: bp("methasterone", {
    c: [
      "In präklinischen Modellen: anabole Effekte als methylierter Drostanolon-Derivat (Superdrol).",
    ],
    note: "Methasteron ist kein zugelassenes Humanarzneimittel; FDA-Rückruf als Nahrungsergänzungsprodukt.",
  }),
  "methyl-1-testosterone": bp("methyl-1-testosterone", {
    c: [
      "In präklinischen Modellen: anabole/androgene Effekte als methylierter Testosteron-Derivat (M1T).",
    ],
    note: "Methyl-1-Testosteron ist kein zugelassenes Humanarzneimittel.",
  }),
};
