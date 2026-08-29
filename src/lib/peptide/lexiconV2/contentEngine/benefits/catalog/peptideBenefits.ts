import { bp } from "@/lib/peptide/lexiconV2/contentEngine/benefits/format";
import type { BenefitsProfile } from "@/lib/peptide/lexiconV2/contentEngine/benefits/types";

function bioregulator(slug: string, tissueDe: string): BenefitsProfile {
  return bp(slug, {
    c: [
      `In präklinischen Modellen und kleineren Beobachtungsstudien wurden zelluläre Effekte im Kontext von ${tissueDe} beschrieben.`,
      "In der Bioregulator-Forschung werden Effekte auf Genexpression und Gewebealterung diskutiert.",
    ],
    p: [
      "In westlichen peer-reviewed Humanstudien ist die Evidenz begrenzt; Ergebnisse variieren und sind nicht konsistent repliziert.",
    ],
  });
}

export const PEPTIDE_BENEFITS: Record<string, BenefitsProfile> = {
  "ss-31": bp("ss-31", {
    w: [
      "In RCTs beim Barth-Syndrom wurden Effekte auf Belastbarkeit und Symptomskalen untersucht.",
      "FDA-beschleunigte Zulassung (Forzinity) für Elamipretid beim Barth-Syndrom auf Basis von Muskelkraft-Messungen.",
    ],
    p: [
      "In Studien bei mitochondrialer Myopathie wurden Effekte auf Gehstrecke und Fatigue untersucht – Ergebnisse variieren.",
    ],
    c: [
      "In präklinischen Modellen: Verbesserung mitochondrialer Bioenergetik über Cardiolipin-Bindung.",
    ],
  }),
  adipotide: bp("adipotide", {
    c: [
      "In präklinischen Mausstudien: Gewichts- und Fettmasse-Reduktion durch gezielte Zerstörung von Fettgewebe-Gefäßen.",
      "In Rhesusaffen: etwa 11 % Gewichtsverlust über vier Wochen in einer Studie.",
    ],
  }),
  "5-amino-1mq": bp("5-amino-1mq", {
    c: [
      "In präklinischen Mausstudien: reduzierte Körpergewichte und weiße Fettmasse unter Hochfett-Diät.",
      "NNMT-Hemmung mit veränderten NAD+-Verhältnissen und Effekten auf Adipozyten.",
    ],
  }),
  "pt-141": bp("pt-141", {
    w: [
      "In Phase-3-Studien (RECONNECT) bei prämenopausalen Frauen mit HSDD: signifikante Verbesserungen bei Sexualverlangen und distress-bezogenen Endpunkten.",
      "Zugelassen als Vyleesi® (Bremelanotid) in den USA für HSDD.",
    ],
  }),
  dsip: bp("dsip", {
    p: [
      "In frühen Humanstudien wurden Effekte auf Schlafarchitektur und Stressmarker diskutiert – Ergebnisse heterogen.",
    ],
    c: [
      "In präklinischen Modellen: Effekte auf Delta-Schlaf und neuroendokrine Achsen.",
    ],
  }),
  epithalon: bp("epithalon", {
    c: [
      "In vitro: Telomerase-Aktivierung in humanen somatischen Zellen.",
      "In präklinischen Modellen: Effekte auf Zellalterung und oxidativen Stress.",
    ],
    p: [
      "Kleinere Humanstudien existieren, sind aber nicht für etablierte Indikationen validiert.",
    ],
  }),
  ll37: bp("ll37", {
    c: [
      "Endogenes antimikrobielles Peptid: Wirkung gegen Bakterien, Viren und Pilze in präklinischen Modellen.",
      "In präklinischen Modellen: immunmodulierende und wundheilungsbezogene Effekte.",
    ],
    p: [
      "Endogenes LL-37 ist beim Menschen gut charakterisiert; exogene Therapie ist investigational.",
    ],
  }),
  "ara-290": bp("ara-290", {
    p: [
      "In Phase-2-Studie bei kleinfaseriger Neuropathie: Verbesserungen von Nervenfunktion und Lebensqualität.",
    ],
    c: [
      "In präklinischen Modellen: neuroprotektive Effekte über Innate-Repair-Receptor.",
    ],
  }),
  humanin: bp("humanin", {
    c: [
      "In präklinischen Modellen: zytoprotektive Effekte bei neurodegenerativen und stoffwechselbezogenen Stressoren.",
      "In Zellstudien: Schutz vor Amyloid-Toxizität und oxidativen Schäden.",
    ],
    p: [
      "Endogenes Humanin ist beim Menschen beschrieben; exogene Therapie ist investigational.",
    ],
  }),
  dihexa: bp("dihexa", {
    c: [
      "In präklinischen Modellen: procognitive und synaptogene Effekte über HGF/c-Met-Signalweg.",
      "In Tiermodellen: Verbesserung der Gedächtnisleistung.",
    ],
  }),
  ibutamoren: bp("ibutamoren", {
    p: [
      "In kontrollierten Humanstudien: Anstiege von GH/IGF-1 und Erhalt von Magermasse bei gesunden Männern.",
      "In Studien bei GH-Mangel und Sarkopenie: Effekte auf Körperzusammensetzung untersucht.",
    ],
  }),
  teriparatide: bp("teriparatide", {
    w: [
      "In zugelassener Indikation (Osteoporose): Zunahme der Knochendichte und Reduktion des Frakturrisikos in RCTs.",
    ],
    p: [
      "Anabole Wirkung auf Knochen über intermittierende PTH-Stimulation.",
    ],
  }),
  oxytocin: bp("oxytocin", {
    w: [
      "In zugelassenen obstetrischen Indikationen: Weheninduktion und Blutungskontrolle postpartum (Pitocin).",
    ],
    p: [
      "In Forschung: Effekte auf soziales Verhalten, Bindung und Stress – Ergebnisse variieren.",
    ],
  }),
  foxo4: bp("foxo4", {
    c: [
      "In präklinischen Mausmodellen: selektive Eliminierung seneszenter Zellen und Verbesserung von Gewebealterung.",
      "In Modellen: Wiederherstellung von Gewebehomöostase nach Chemotoxizität.",
    ],
  }),
  "ghrp-2": bp("ghrp-2", {
    p: [
      "In Humanstudien: GH- und IGF-1-Anstiege bei GH-defizienten Erwachsenen.",
    ],
    c: [
      "Als GHS-Rezeptor-Agonist: GH-Freisetzung in präklinischen Modellen.",
    ],
  }),
  "ghrp-6": bp("ghrp-6", {
    p: [
      "In Humanstudien: GH-Anstiege bei GH-defizienten Erwachsenen.",
    ],
    c: [
      "GHS-Rezeptor-Agonismus und Appetitstimulation in präklinischen Modellen.",
    ],
  }),
  hexarelin: bp("hexarelin", {
    p: [
      "In Humanstudien: GH-Sekretion bei GH-defizienten Erwachsenen.",
    ],
    c: [
      "Potenter GHS-Rezeptor-Agonist in präklinischen Modellen.",
    ],
  }),
  "ace-031": bp("ace-031", {
    p: [
      "In Phase-2-Studie bei Duchenne-Muskeldystrophie: Erhalt bzw. Zunahme der Magermasse und Verbesserung der Gehstrecke.",
    ],
    c: [
      "Als Aktivin-Inhibitor: Erhöhung der Muskelmasse in präklinischen Modellen.",
    ],
  }),
  "kisspeptin-10": bp("kisspeptin-10", {
    p: [
      "In Humanstudien: Stimulation der hypothalamisch-hypophysär-gonadalen Achse (LH/FSH-Anstiege).",
    ],
    c: [
      "In präklinischen Modellen: zentraler Trigger der Pubertät und reproduktiven Achse.",
    ],
  }),
  "pe-22-28": bp("pe-22-28", {
    c: [
      "In präklinischen Modellen: Förderung der Hippocampus-Neurogenese über Sp8-Modulation.",
      "In Zellstudien: neuroprotektive Effekte.",
    ],
  }),
  "peg-mgf": bp("peg-mgf", {
    c: [
      "In präklinischen Modellen: Förderung der Muskelzellreparatur und -regeneration als IGF-1-Splice-Variante.",
      "Pegylierung verlängert die Halbwertszeit gegenüber nativem MGF.",
    ],
  }),
  mgf: bp("mgf", {
    c: [
      "In präklinischen Modellen: lokale Muskelreparatur und Satellitenzellaktivierung nach mechanischer Belastung.",
    ],
  }),
  adamax: bp("adamax", {
    p: [
      "Als modifiziertes Semax-Derivat: in der Forschung diskutierte nootrope und neuroprotektive Effekte – Evidenz begrenzt.",
    ],
    c: [
      "In präklinischen Modellen: Effekte auf BDNF-Expression und kognitive Funktion.",
    ],
  }),
  "ahk-cu": bp("ahk-cu", {
    c: [
      "In präklinischen Modellen: Effekte auf Haarfollikel, Kollagensynthese und Hautregeneration als Kupferpeptid.",
    ],
    p: [
      "Humane Daten zu AHK-Cu sind begrenzt; GHK-Cu hat eine umfangreichere Literatur.",
    ],
  }),
  "slu-pp-332": bp("slu-pp-332", {
    c: [
      "In präklinischen Mausstudien: ERR-Agonismus mit verbesserter Ausdauer und mitochondrialer Funktion.",
      "In Tierstudien: Effekte vergleichbar mit Ausdauertraining auf Stoffwechsel.",
    ],
  }),
  "snap-8": bp("snap-8", {
    c: [
      "In präklinischen Modellen: Hemmung der Acetylcholin-Freisetzung und reduzierte Muskelkontraktion (topisch, Falten).",
      "In vitro: Effekte auf mimische Faltenbildung vergleichbar mit Botulinum-Toxin-Mechanismus.",
    ],
    p: [
      "Humane Studien zu SNAP-8 als Kosmetikpeptid sind begrenzt.",
    ],
  }),
  nad: bp("nad", {
    p: [
      "NAD+-Vorstufen (NMN, NR) in Humanstudien: Erhöhung der NAD+-Spiegel und Effekte auf Stoffwechselmarker.",
    ],
    c: [
      "In präklinischen Modellen: zentraler Coenzym-Stoffwechsel mit Effekten auf Alterung, mitochondriale Funktion und DNA-Reparatur.",
    ],
  }),
  "n-acetyl-epitalon-amidate": bp("n-acetyl-epitalon-amidate", {
    c: [
      "Modifiziertes Epithalon-Derivat: in präklinischen Modellen diskutierte Effekte auf Telomerase und Zellalterung.",
    ],
    p: [
      "Humane Studien zu dieser spezifischen Modifikation fehlen weitgehend.",
    ],
  }),
  dermorphin: bp("dermorphin", {
    c: [
      "In präklinischen Modellen: potentes μ-Opioid-Rezeptor-Agonist-Peptid aus Amphibienhaut.",
      "In Tierstudien: analgetische und analgetische Effekte.",
    ],
    note: "Dermorphin ist kein zugelassenes Humanarzneimittel; potentes Opioid mit erheblichem Missbrauchs- und Sicherheitsrisiko.",
  }),
  hmg: bp("hmg", {
    w: [
      "In zugelassener Indikation (Unfruchtbarkeit): Stimulation der Follikelreifung und Ovulation.",
      "Kombination aus FSH- und LH-Aktivität für Gonadotropin-Therapie.",
    ],
  }),
  vip: bp("vip", {
    p: [
      "In Studien bei inflammatorischen Darmerkrankungen und PAH: immunmodulierende und vasoaktive Effekte untersucht.",
    ],
    c: [
      "In präklinischen Modellen: antiinflammatorische und bronchodilatatorische Effekte.",
    ],
  }),
  matrixyl: bp("matrixyl", {
    c: [
      "In präklinischen und kosmetischen Studien: Förderung der Kollagensynthese und Reduktion von Falten (Palmitoyl-Pentapeptid).",
    ],
    p: [
      "In kleineren Humanstudien (topisch): Verbesserung der Hautelastizität und Faltenreduktion.",
    ],
  }),
  p21: bp("p21", {
    c: [
      "In präklinischen Modellen: Cdk-inhibitorisches Peptid mit Effekten auf Zellzyklus und Neuroprotektion.",
    ],
  }),
  "pnc-27": bp("pnc-27", {
    c: [
      "In präklinischen Modellen: selektive Tumorzell-Nekrose über p53-abhängigen Mechanismus.",
      "In Zellstudien: zytotoxische Effekte auf maligne Zellen bei intakter Membran.",
    ],
  }),
  bronchogen: bioregulator("bronchogen", "Atemwegs- und Lungengewebe"),
  cardiogen: bioregulator("cardiogen", "Herz- und Gefäßgewebe"),
  cortagen: bioregulator("cortagen", "Nebennierenrinde und Stressachse"),
  crystagen: bioregulator("crystagen", "Immunsystem und Lymphoidgewebe"),
  cartalax: bioregulator("cartalax", "Knorpel- und Bindegewebe"),
  livagen: bioregulator("livagen", "Lebergewebe"),
  ovagen: bioregulator("ovagen", "Eierstock- und Reproduktionsgewebe"),
  pancragen: bioregulator("pancragen", "Pankreasgewebe"),
  pinealon: bioregulator("pinealon", "ZNS und Pinealdrüse"),
  prostamax: bioregulator("prostamax", "Prostatagewebe"),
  testagen: bioregulator("testagen", "Hoden- und Testesgewebe"),
  thymalin: bioregulator("thymalin", "Thymus und Immunsystem"),
  vesugen: bioregulator("vesugen", "Gefäß-Endothel"),
  vilon: bioregulator("vilon", "Immunsystem und Thymus"),
};
