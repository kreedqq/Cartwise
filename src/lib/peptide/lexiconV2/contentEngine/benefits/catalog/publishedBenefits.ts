import { bp } from "@/lib/peptide/lexiconV2/contentEngine/benefits/format";
import type { BenefitsProfile } from "@/lib/peptide/lexiconV2/contentEngine/benefits/types";

/** Benefits for the 27 published research profiles. */
export const PUBLISHED_BENEFITS: Record<string, BenefitsProfile> = {
  retatrutide: bp("retatrutide", {
    p: [
      "In randomisierten Phase-2-Studien bei Adipositas wurde unter Retatrutid eine deutliche Gewichtsabnahme beobachtet.",
      "In klinischen Studien bei Typ-2-Diabetes wurden Verbesserungen glykämischer Parameter untersucht.",
      "Weitere untersuchte Endpunkte umfassen metabolische und kardiometabolische Marker – Ergebnisse sind kontext- und endpunktabhängig.",
    ],
    c: [
      "Als triple GIP/GLP-1/Glucagon-Agonist werden in der Literatur kombinierte Effekte auf Appetit, Energieverwertung und Glukosestoffwechsel diskutiert.",
    ],
  }),
  tirzepatide: bp("tirzepatide", {
    w: [
      "In zugelassenen Indikationen (Typ-2-Diabetes) wurde eine verbesserte glykämische Kontrolle (HbA1c-Reduktion) in großen RCTs gezeigt.",
      "In Studien zur Adipositas wurde eine signifikante Gewichtsreduktion gegenüber Placebo beschrieben.",
    ],
    p: [
      "Weitere untersuchte Endpunkte umfassen kardiometabolische Parameter und Leberfett – je nach Studiendesign und Population.",
    ],
  }),
  semaglutide: bp("semaglutide", {
    w: [
      "In zugelassenen Indikationen (Typ-2-Diabetes) wurde eine verbesserte glykämische Kontrolle in großen RCTs gezeigt.",
      "In Adipositas-Studien (STEP-Programm) wurde eine signifikante Gewichtsreduktion gegenüber Placebo beschrieben.",
      "In kardiovaskulären Outcome-Studien bei Typ-2-Diabetes wurden reduzierte major adverse cardiovascular events (MACE) berichtet – für die geprüfte Population.",
    ],
  }),
  liraglutide: bp("liraglutide", {
    w: [
      "In zugelassenen Indikationen (Typ-2-Diabetes) wurde eine verbesserte glykämische Kontrolle gezeigt.",
      "In Adipositas-Studien (SCALE) wurde eine signifikante Gewichtsreduktion gegenüber Placebo beschrieben.",
    ],
    p: [
      "In kardiovaskulären Outcome-Studien wurden Effekte auf MACE-Endpunkte untersucht – kontextabhängig.",
    ],
  }),
  cagrilintide: bp("cagrilintide", {
    p: [
      "In Kombination mit Semaglutid (CagriSema) wurden in Phase-2/3-Studien deutliche Gewichtsreduktionen und Verbesserungen metabolischer Parameter beschrieben.",
      "Als Amylin-Analogon werden Effekte auf Sättigung und Gewichtsregulation untersucht.",
    ],
    c: [
      "Amylin-Agonismus wird mit verzögerter Magenentleerung und reduziertem Appetit in präklinischen Modellen in Verbindung gebracht.",
    ],
  }),
  mazdutide: bp("mazdutide", {
    p: [
      "In Phase-2-Studien bei Adipositas wurde unter Mazdutid eine signifikante Gewichtsreduktion gegenüber Placebo beschrieben.",
      "Als dual GLP-1/Glucagon-Agonist wurden Effekte auf glykämische und metabolische Parameter untersucht.",
    ],
  }),
  orforglipron: bp("orforglipron", {
    p: [
      "In Phase-2-Studien bei Typ-2-Diabetes und Adipositas wurden Gewichts- und HbA1c-Reduktionen gegenüber Placebo beschrieben.",
      "Als oraler nicht-peptidischer GLP-1-Rezeptor-Agonist wird eine verbesserte Compliance durch orale Gabe untersucht.",
    ],
  }),
  tesamorelin: bp("tesamorelin", {
    w: [
      "In zugelassener Indikation (HIV-assoziierte viszerale Adipositas) wurde eine Reduktion viszeralen Fetts in RCTs beschrieben.",
    ],
    p: [
      "Weitere untersuchte Endpunkte umfassen IGF-1-Anstiege und Körperzusammensetzung – für die geprüfte Population.",
    ],
  }),
  "cjc-1295": bp("cjc-1295", {
    p: [
      "In Humanstudien mit CJC-1295 (mit DAC) wurden anhaltende Anstiege von GH und IGF-1 beschrieben.",
      "Effekte auf Körperzusammensetzung wurden in kleineren Studien untersucht – Ergebnisse sind begrenzt.",
    ],
    c: [
      "Als GHRH-Analogon wird die Stimulation der hypophysären GH-Freisetzung in präklinischen Modellen beschrieben.",
    ],
  }),
  ipamorelin: bp("ipamorelin", {
    p: [
      "In Humanstudien wurden GH-Anstiege mit vergleichsweise selektivem Profil (geringere Cortisol-/Prolactin-Stimulation als andere Sekretagoge) beschrieben.",
    ],
    c: [
      "Als GHRP-Rezeptor-Agonist wird die GH-Freisetzung in präklinischen Modellen gezeigt.",
    ],
  }),
  "bpc-157": bp("bpc-157", {
    c: [
      "In präklinischen Modellen (Rodentia) wurden Effekte auf Gewebereparatur, Angiogenese und Entzündungsprozesse beschrieben.",
      "In Tierstudien wurden gastrointestinale Schutz- und Heilungseffekte untersucht.",
      "In präklinischen Modellen wurden Effekte auf Sehnen-, Muskel- und Gefäßgewebe diskutiert.",
    ],
    p: [
      "Humane Daten beschränken sich auf sehr kleine oder nicht kontrollierte Berichte – keine belastbare Human-RCT-Evidenz für Wirksamkeit.",
    ],
  }),
  "tb-500": bp("tb-500", {
    c: [
      "TB-500 (synthetisches Thymosin-β4-Fragment) wurde in präklinischen Modellen im Kontext von Gewebereparatur, Angiogenese und Zellmigration untersucht.",
      "In Tierstudien wurden Effekte auf Wundheilung und Muskel-/Sehnengewebe beschrieben.",
    ],
    p: [
      "Für TB-500 als Shop-Identität liegen keine belastbaren, publizierten Human-RCTs vor. Thymosin Beta-4 (eigenes Profil) hat eine separate Evidenzlage.",
    ],
  }),
  "ghk-cu": bp("ghk-cu", {
    p: [
      "In kleineren Humanstudien und kosmetischen Anwendungen wurden Effekte auf Hautfeuchtigkeit, Elastizität und Faltenbild untersucht – Ergebnisse variieren.",
    ],
    c: [
      "In präklinischen und in-vitro-Studien wurden Effekte auf Kollagensynthese, Wundheilung und Haarfollikel-Funktion beschrieben.",
      "In Hautmodellen wurden regenerative und entzündungsmodulierende Effekte diskutiert.",
      "Effekte auf Nägel und Bindegewebe wurden in begrenzten Studien untersucht.",
    ],
  }),
  "mots-c": bp("mots-c", {
    c: [
      "In präklinischen Modellen wurde MOTS-c als mitochondriales Peptid im Stoffwechsel, bei Insulinsensitivität und körperlicher Belastung untersucht.",
      "In Tierstudien wurden Effekte auf Glukosestoffwechsel und Ausdauer beschrieben.",
    ],
    p: [
      "Belastbare, abgeschlossene Human-RCTs mit publizierten Ergebnissen zur exogenen MOTS-c-Gabe fehlen weitgehend.",
    ],
  }),
  "aod-9604": bp("aod-9604", {
    c: [
      "AOD-9604 ist ein Fragment des Wachstumshormons (HGH 176-191), das in präklinischen Modellen auf Fettstoffwechsel untersucht wurde.",
      "In Tierstudien wurden Effekte auf Lipolyse ohne starke IGF-1-Induktion beschrieben.",
    ],
    p: [
      "In Humanstudien wurden begrenzte Effekte auf Körperzusammensetzung untersucht – keine etablierte Zulassung oder robuste Human-Evidenz.",
    ],
  }),
  sermorelin: bp("sermorelin", {
    w: [
      "Sermorelin (GHRH 1-29) ist in den USA als diagnostisches Mittel zur Beurteilung der GH-Reserve zugelassen.",
    ],
    p: [
      "In Studien wurden GH-Anstiege nach Gabe beschrieben; therapeutische Anwendungen außerhalb der Diagnostik sind nicht breit etabliert.",
    ],
  }),
  "thymosin-beta-4": bp("thymosin-beta-4", {
    p: [
      "Thymosin Beta-4 wurde in klinischen Studien bei Augenerkrankungen (z. B. neurotrophihe Keratopathie) und Wundheilung untersucht.",
    ],
    c: [
      "In präklinischen Modellen wurden Effekte auf Zellmigration, Angiogenese und Gewebereparatur beschrieben.",
    ],
  }),
  semax: bp("semax", {
    p: [
      "In Humanstudien (primär Russland) wurden Effekte auf kognitive Funktion, Aufmerksamkeit und Stressreaktion untersucht – Evidenz ist regional begrenzt und nicht international repliziert.",
    ],
    c: [
      "In präklinischen Modellen wurden neuroprotektive und nootrope Effekte über BDNF- und Dopamin-Systeme diskutiert.",
    ],
  }),
  selank: bp("selank", {
    p: [
      "In Humanstudien (primär Russland) wurden anxiolytische und nootrope Effekte untersucht – Evidenz ist regional begrenzt.",
    ],
    c: [
      "In präklinischen Modellen wurden Effekte auf GABAerge Systeme und Enkephalin-Metabolismus beschrieben.",
    ],
  }),
  "thymosin-alpha-1": bp("thymosin-alpha-1", {
    w: [
      "Thymosin Alpha-1 (Thymalfasin) ist in mehreren Ländern für bestimmte Indikationen (z. B. chronische Hepatitis B, als Immunmodulator) zugelassen.",
    ],
    p: [
      "In Studien wurden Effekte auf Immunantwort und virale Clearance untersucht – je nach Indikation und Studiendesign.",
    ],
    c: [
      "In präklinischen Modellen wurden T-Zell-modulierende und immunstimulierende Effekte beschrieben.",
    ],
  }),
  kpv: bp("kpv", {
    c: [
      "KPV (Lys-Pro-Val) ist ein α-MSH-Fragment, das in präklinischen Modellen entzündungshemmende und antimikrobielle Effekte zeigte.",
      "In Tierstudien wurden Effekte auf intestinale Entzündung und Kolitis-Modelle beschrieben.",
    ],
    p: [
      "Humane kontrollierte Studien zur exogenen KPV-Gabe fehlen weitgehend.",
    ],
  }),
  "igf-1-lr3": bp("igf-1-lr3", {
    c: [
      "IGF-1 LR3 ist eine langwirkende IGF-1-Variante, die in präklinischen Modellen anabole und zellwachstumsfördernde Effekte zeigte.",
      "In Tierstudien wurden Effekte auf Muskelmasse und Gewebehypertrophie beschrieben.",
    ],
    p: [
      "Für IGF-1 LR3 als Forschungspeptid liegen keine zugelassenen Humantherapien oder robuste RCTs vor. Mecasermin (recombinantes IGF-1) hat eine separate, zugelassene Evidenzlage.",
    ],
  }),
  somatropin: bp("somatropin", {
    w: [
      "Recombinantes Somatropin (Wachstumshormon) ist in zugelassenen Indikationen (z. B. GH-Mangel bei Kindern/Erwachsenen, bestimmte Wachstumsstörungen) etabliert.",
      "In zugelassenen Indikationen wurden Effekte auf Wachstum, Körperzusammensetzung und metabolische Parameter gezeigt.",
    ],
  }),
  hcg: bp("hcg", {
    w: [
      "HCG ist in zugelassenen Indikationen (z. B. Hypogonadismus, Unfruchtbarkeit, Kryptorchismus) etabliert.",
      "In der Unfruchtbarkeitsbehandlung wird HCG zur Auslösung des Eisprungs und zur Stimulation der Gonadenfunktion eingesetzt.",
    ],
    p: [
      "In Studien wurden Effekte auf Testosteronspiegel und Spermatogenese untersucht – je nach Indikation.",
    ],
  }),
  gonadorelin: bp("gonadorelin", {
    w: [
      "Gonadorelin (GnRH) ist als diagnostisches und therapeutisches Mittel zur Beurteilung bzw. Stimulation der hypothalamisch-hypophysär-gonadalen Achse zugelassen.",
    ],
    p: [
      "In Studien wurden LH/FSH-Anstiege und Effekte auf reproduktive Endpunkte beschrieben – kontextabhängig.",
    ],
  }),
  "melanotan-ii": bp("melanotan-ii", {
    p: [
      "In Humanstudien wurden Effekte auf Hautpigmentierung (Melanogenese) und erektile Funktion untersucht – nicht zugelassen als Humanarzneimittel.",
    ],
    c: [
      "Als Melanocortin-Rezeptor-Agonist werden in präklinischen Modellen Effekte auf α-MSH-Signalwege beschrieben.",
    ],
  }),
  "glow-blend": bp("glow-blend", {
    p: [
      "Für GHK-Cu existieren Hinweise auf dermatologische und regenerative Effekte (siehe GHK-Cu-Profil).",
      "Für TB-500 existieren präklinische Hinweise auf Gewebereparatur (siehe TB-500-Profil).",
      "Für BPC-157 existieren präklinische Hinweise auf Gewebeheilung und GI-Effekte (siehe BPC-157-Profil).",
    ],
    note:
      "Für die konkrete GLOW-Blend-Kombination (GHK-Cu + TB-500 + BPC-157) liegen keine ausreichenden klinischen Studien vor. Aussagen zu Einzelkomponenten dürfen nicht automatisch auf die Mischung übertragen werden.",
  }),
  "klow-blend": bp("klow-blend", {
    p: [
      "Für GHK-Cu existieren Hinweise auf dermatologische und regenerative Effekte (siehe GHK-Cu-Profil).",
      "Für TB-500 existieren präklinische Hinweise auf Gewebereparatur (siehe TB-500-Profil).",
      "Für BPC-157 existieren präklinische Hinweise auf Gewebeheilung und GI-Effekte (siehe BPC-157-Profil).",
    ],
    note:
      "Die verfügbaren wissenschaftlichen Daten beziehen sich auf einzelne Bestandteile; die Kombination als KLOW-Blend ist nicht entsprechend klinisch untersucht. KLOW unterscheidet sich von GLOW durch zusätzliches TB-500 laut Shop-Katalogbezeichnung.",
  }),
};
