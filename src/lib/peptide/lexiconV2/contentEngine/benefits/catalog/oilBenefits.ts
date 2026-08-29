import { bp } from "@/lib/peptide/lexiconV2/contentEngine/benefits/format";
import type { BenefitsProfile } from "@/lib/peptide/lexiconV2/contentEngine/benefits/types";

const TESTOSTERONE_BENEFITS = {
  w: [
    "Androgenrezeptor-vermittelte Wirkung: Wiederherstellung physiologischer Testosteronspiegel bei Hypogonadismus.",
    "In zugelassener TRT: Verbesserung von Libido, Energie, Körperzusammensetzung und Knochendichte.",
    "Erhöhung der Magermasse und Reduktion von Fettmasse bei hypogonadalen Männern in Studien.",
  ],
};

export const OIL_BENEFITS: Record<string, BenefitsProfile> = {
  "testosterone-cypionate": bp("testosterone-cypionate", TESTOSTERONE_BENEFITS),
  "testosterone-enanthate": bp("testosterone-enanthate", TESTOSTERONE_BENEFITS),
  "testosterone-propionate": bp("testosterone-propionate", TESTOSTERONE_BENEFITS),
  "testosterone-undecanoate": bp("testosterone-undecanoate", TESTOSTERONE_BENEFITS),
  "testosterone-suspension": bp("testosterone-suspension", TESTOSTERONE_BENEFITS),
  "testosterone-600": bp("testosterone-600", TESTOSTERONE_BENEFITS),
  "test-base": bp("test-base", {
    w: TESTOSTERONE_BENEFITS.w,
    p: ["Test Base (wasserfreies Testosteron) ohne Ester: schnellerer Wirkungseintritt in Studien – gleiche androgene Wirkmechanismen."],
  }),
  "nandrolone-decanoate": bp("nandrolone-decanoate", {
    w: [
      "In zugelassener Indikation (Anämie bei chronischer Niereninsuffizienz): Stimulation der Erythropoese.",
      "Bei postmenopausaler Osteoporose: Erhalt bzw. Zunahme der Knochendichte in Studien.",
    ],
    p: [
      "Anabole Effekte auf Muskelmasse und Körperzusammensetzung in medizinischen Studien.",
    ],
  }),
  "nandrolone-phenylpropionate": bp("nandrolone-phenylpropionate", {
    w: [
      "Als Nandrolon-Ester: gleiche Wirkstoffklasse wie Nandrolon-Decanoat – anabole/androgene Effekte in medizinischen Indikationen.",
    ],
    p: [
      "Kürzere Halbwertszeit als Decanoat; medizinische Nutzenprofile gelten für etablierte Nandrolon-Indikationen.",
    ],
  }),
  "estradiol-cypionate": bp("estradiol-cypionate", {
    w: [
      "In Hormonersatztherapie: Linderung menopausaler Symptome (Hitzewallungen, vaginale Atrophie).",
      "Erhalt der Knochendichte bei Östrogenmangel.",
    ],
  }),
  "stanozolol-oil": bp("stanozolol-oil", {
    w: [
      "In zugelassener Indikation (hereditäres Angioödem): Reduktion der Häufigkeit und Schwere von Angioödem-Anfällen.",
    ],
    p: [
      "Anabole Effekte auf Muskelmasse in medizinischen Kontexten.",
    ],
  }),
  "stanozolol-water": bp("stanozolol-water", {
    w: [
      "In zugelassener Indikation (hereditäres Angioödem): Reduktion der Häufigkeit und Schwere von Angioödem-Anfällen.",
    ],
    p: [
      "Wasserbasierte Formulierung desselben Wirkstoffs – gleiche Indikationsprofile.",
    ],
  }),
  "drostanolone-propionate": bp("drostanolone-propionate", {
    p: [
      "Historisch bei Mammakarzinom: antiöstrogene und anabole Effekte in Studien der 1970er–1980er Jahre.",
    ],
    c: [
      "Als DHT-Derivat: androgenrezeptor-vermittelte anabole Wirkung in präklinischen Modellen.",
    ],
    note: "Drostanolon ist in den meisten Märkten nicht mehr breit zugelassen.",
  }),
  "drostanolone-enanthate": bp("drostanolone-enanthate", {
    p: [
      "Länger wirkender Drostanolon-Ester – historische medizinische Anwendungen bei Mammakarzinom dokumentiert.",
    ],
    c: [
      "Androgenrezeptor-vermittelte anabole Wirkung in präklinischen Modellen.",
    ],
  }),
  "boldenone-undecylenate": bp("boldenone-undecylenate", {
    p: [
      "Historisch in der Veterinärmedizin: anabole Effekte auf Muskelmasse und Appetit.",
    ],
    c: [
      "In präklinischen Modellen: anabole Wirkung mit moderater Androgenität; Erythropoese-Stimulation.",
    ],
    note: "Boldenon ist kein zugelassenes Humanarzneimittel.",
  }),
  "boldenone-cypionate": bp("boldenone-cypionate", {
    p: [
      "Cypionat-Ester von Boldenon – gleiche Wirkstoffklasse wie Boldenon-Undecylenat.",
    ],
    c: [
      "Anabole Effekte und Erythropoese-Stimulation in präklinischen Modellen.",
    ],
  }),
  "trenbolone-acetate": bp("trenbolone-acetate", {
    c: [
      "In präklinischen Modellen: potente anabole/androgene Wirkung; Bindung an Androgen- und Progesteronrezeptor.",
      "In der Veterinärmedizin: Förderung der Muskelmasse und Futtereffizienz bei Nutztieren.",
    ],
    note: "Trenbolon ist kein zugelassenes Humanarzneimittel.",
  }),
  "trenbolone-enanthate": bp("trenbolone-enanthate", {
    c: [
      "Länger wirkender Trenbolon-Ester – anabole/androgene Wirkung in präklinischen Modellen.",
    ],
    note: "Trenbolon ist kein zugelassenes Humanarzneimittel.",
  }),
  "trenbolone-hexahydrobenzylcarbonate": bp("trenbolone-hexahydrobenzylcarbonate", {
    c: [
      "Länger wirkender Trenbolon-Ester (Parabolan-Historie) – anabole Wirkung in präklinischen Modellen.",
    ],
    note: "Trenbolon ist kein zugelassenes Humanarzneimittel.",
  }),
  "tren-base": bp("tren-base", {
    c: [
      "Esterfreies Trenbolon – potente anabole/androgene Wirkung in präklinischen Modellen.",
    ],
    note: "Trenbolon ist kein zugelassenes Humanarzneimittel.",
  }),
  "methenolone-enanthate": bp("methenolone-enanthate", {
    p: [
      "Historisch: milde anabole Effekte bei Anämie und Muskelerkrankungen in medizinischen Studien (Primobolan).",
    ],
    c: [
      "In präklinischen Modellen: anabole Wirkung mit geringer Androgenität und minimaler aromatisierbarer Aktivität.",
    ],
  }),
  "methenolone-acetate": bp("methenolone-acetate", {
    p: [
      "Kürzer wirkender Methenolon-Ester – historische medizinische Anwendungen bei Anämie.",
    ],
    c: [
      "Milde anabole Wirkung in präklinischen Modellen.",
    ],
  }),
  "dhb-1-test-cyp": bp("dhb-1-test-cyp", {
    c: [
      "Dihydroboldenon (1-Testosteron) – potenter Androgenrezeptor-Agonist in präklinischen Modellen.",
      "In Tierstudien: anabole Effekte ohne Aromatisierung.",
    ],
    note: "DHB ist kein zugelassenes Humanarzneimittel.",
  }),
  ment: bp("ment", {
    c: [
      "Trestolon (7α-Methyl-19-Nortestosteron): potenter anaboler Wirkstoff in präklinischen Modellen.",
      "In Tierstudien: starke anabole Wirkung bei reduzierter Prostatabeeinflussung.",
    ],
    p: [
      "In frühen Humanstudien als Kontrazeptivum untersucht – keine breite Zulassung.",
    ],
  }),
  "dht-stanolone": bp("dht-stanolone", {
    p: [
      "Als DHT (Dihydrotestosteron): potente androgene Wirkung; in Studien bei Mikropenis und bestimmten DHT-Mangel-Syndromen.",
    ],
    c: [
      "Nicht-aromatisierbares Androgen – androgenrezeptor-vermittelte Wirkung in präklinischen Modellen.",
    ],
  }),
};
