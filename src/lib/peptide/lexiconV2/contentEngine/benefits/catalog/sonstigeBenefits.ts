import { bp } from "@/lib/peptide/lexiconV2/contentEngine/benefits/format";
import type { BenefitsProfile } from "@/lib/peptide/lexiconV2/contentEngine/benefits/types";

export const SONSTIGE_BENEFITS: Record<string, BenefitsProfile> = {
  epo: bp("epo", {
    w: [
      "In zugelassener Indikation (Anämie bei chronischer Niereninsuffizienz, Chemotherapie): Stimulation der Erythropoese und Reduktion des Transfusionsbedarfs.",
    ],
    p: [
      "In Studien bei kritisch kranken Patienten und im Sportmissbrauch: Erhöhung der Ausdauer durch verbesserte Sauerstofftransportkapazität – Missbrauch birgt erhebliche Risiken.",
    ],
  }),
  cerebrolysin: bp("cerebrolysin", {
    p: [
      "In Studien bei Demenz, Schlaganfall und TBI: Effekte auf kognitive Funktion und neuroprotektive Marker untersucht – Ergebnisse variieren je nach Indikation.",
    ],
    c: [
      "In präklinischen Modellen: neurotrophe Effekte und Förderung der neuronalen Plastizität.",
    ],
  }),
  glutathione: bp("glutathione", {
    w: [
      "Endogenes Antioxidans: zentraler Rolle im zellulären Redox-Stoffwechsel und Detoxifikation.",
    ],
    p: [
      "In Studien (i.v./oral/inhalativ): Effekte auf oxidativen Stress, Leberfunktion und Hautaufhellung untersucht – Ergebnisse variieren.",
    ],
    c: [
      "In präklinischen Modellen: zytoprotektive und immunmodulierende Effekte.",
    ],
  }),
  b12: bp("b12", {
    w: [
      "In zugelassener Indikation (B12-Mangel): Korrektur des Mangels mit Verbesserung von Anämie und neurologischen Symptomen.",
    ],
  }),
  "hyaluronic-acid": bp("hyaluronic-acid", {
    w: [
      "In zugelassenen Formulierungen (intraartikulär): Verbesserung der Gelenkfunktion bei Osteoarthritis.",
      "Topisch/injizierbar: Volumenaufbau und Hydratation in der Dermatologie und Ästhetik.",
    ],
    p: [
      "In Studien: Verbesserung der Hautfeuchtigkeit und Gelenkschmierung.",
    ],
  }),
  alprostadil: bp("alprostadil", {
    w: [
      "In zugelassener Indikation (erektiler Dysfunktion): Verbesserung der Erektion durch vasodilatatorische Wirkung (intracavernos/intraurethral).",
      "Bei pulmonaler Hypertonie bei Neugeborenen: Vasodilatation und Verbesserung der Oxygenierung.",
    ],
  }),
  "botulinum-toxin": bp("botulinum-toxin", {
    w: [
      "In zugelassenen Indikationen: Hemmung der Acetylcholin-Freisetzung an der neuromuskulären Synapse.",
      "Bei Spastik, Dystonie, Migräne, Hyperhidrose und kosmetischer Faltenbehandlung: klinisch nachgewiesene Wirksamkeit in RCTs.",
    ],
  }),
};
