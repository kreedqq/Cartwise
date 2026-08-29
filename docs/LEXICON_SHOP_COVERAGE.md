# Lexikon Shop Coverage Matrix

Generiert: **2026-08-29**  
Quelle: `products` (Production Dump 0031) + `LIVE_SHOP_PRODUCTS` (320 SKUs)  
Regeln: exakte Namensgruppen, `postgresMappingSlug`, keine Fuzzy-Mappings, getrennte Identitäten (TB-500 ≠ Thymosin Beta-4, MT-II ≠ Afamelanotid, IGF-1 LR3 ≠ Mecasermin, urinary hCG ≠ Ovitrelle).

## Zusammenfassung

| Kennzahl | Wert |
|---|---:|
| Shopprodukte gesamt | 320 |
| Eindeutig gemappt | 289 |
| Mehrere Varianten (SKUs) | 208 |
| Varianten-Familien | 67 |
| Neue Lexikonprofile erforderlich | 152 |
| COMPLETE (27 Research-Identitäten) | 93 |
| PARTIAL | 193 |
| Review Required | 20 |
| Unknown | 11 |
| Non-Lexicon | 3 |

## Kategorien

- BLENDS: **22**
- HILFSSTOFFE: **3**
- OILS / INJECTABLES: **38**
- ORALS: **68**
- PEPTIDES: **173**
- SONSTIGE: **16**

## Produkte ohne eindeutige Zuordnung (31)

- **B10F** · TB-500 (FRAG) · REVIEW_REQUIRED · Fragment label plus TB-500/TB4 mix; not mapped.
- **B300** · BLEND 300mg · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **B375** · BLEND 375mg · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **B500** · BLEND 500mg · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **B70** · COCK BOMBS · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **BB10** · BPC157 5mg+TB500 5mg Blend · REVIEW_REQUIRED · Two-substance blend; no blend identity slug.
- **BB20** · BPC157 10mg+TB500 10mg Blend · REVIEW_REQUIRED · Two-substance blend; no blend identity slug.
- **BB500** · BPC 500mcg+TB500 500mcg Blend · REVIEW_REQUIRED · Two-substance blend; no blend identity slug.
- **BT10** · TB-500 (Thymosin B4 Acetate) · REVIEW_REQUIRED · Shop label mixes TB-500 and Thymosin Beta-4; identities stay separate.
- **BT20** · TB-500 (Thymosin B4 Acetate) · REVIEW_REQUIRED · Shop label mixes TB-500 and Thymosin Beta-4; identities stay separate.
- **BT5** · TB-500 (Thymosin B4 Acetate) · REVIEW_REQUIRED · Shop label mixes TB-500 and Thymosin Beta-4; identities stay separate.
- **CP10** · CJC-1295 without DAC 5mg + IPA 5mg Blend · REVIEW_REQUIRED · Two-substance blend.
- **CP20** · CJC-1295 without DAC 10mg + IPA 10mg · REVIEW_REQUIRED · Two-substance blend.
- **CS10** · Cagrilintide 5mg+Semaglutide 5mg Blend · REVIEW_REQUIRED · Two-substance blend; do not pick one INN.
- **FR10** · HGH Fragment 176-191 · REVIEW_REQUIRED · Fragment is not somatropin.
- **FR2** · HGH Fragment 176-191 · REVIEW_REQUIRED · Fragment is not somatropin.
- **FR5** · HGH Fragment 176-191 · REVIEW_REQUIRED · Fragment is not somatropin.
- **GGH** · GGH · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **HHB** · HHB · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **KL80** · (KLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg+TB500 10mg Blend · REVIEW_REQUIRED · Klow is not the glow-blend identity (extra TB-500).
- **LC500** · LC500 · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **LC526** · LC526 · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **LC653** · LC653 · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **MT1** · MT-1 · REVIEW_REQUIRED · Melanotan I is not Melanotan II; prefix ^MT[0-9] must not stand.
- **NSK30** · NA Selank amide · REVIEW_REQUIRED · Modified analogue; not mapped to selank without a separate identity.
- **NXA30** · NA Semax amide · REVIEW_REQUIRED · Modified analogue; not mapped to semax without a separate identity.
- **RC10** · Retatrutide 5mg+Cagrilintide 5mg Blend · REVIEW_REQUIRED · Two-substance blend; do not pick one INN.
- **RX225** · RIPEX · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **SHB** · SHB · UNKNOWN · Shopbezeichnung ohne identifizierbaren Wirkstoff.
- **TI18** · Tesamorelin 12mg+Ipamorelin 6mg · REVIEW_REQUIRED · Two-substance blend.
- **XS20** · Semax 10mg+Selank 10mg · REVIEW_REQUIRED · Two-substance blend.

## Vollständige Matrix

| Code | Produkt | Kategorie | Wirkstoff | Variante | Profil nötig | Mapping eindeutig | Status | Grund |
|---|---|---|---|---|---|---|---|---|
| 10AD | AOD9604 | PEPTIDES | AOD9604 | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| 10AM | 5-amino-1mq | ORALS | 5-amino-1mq | 10mg/vial x 10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 1T100 | DHB (1-Test Cyp) | OILS / INJECTABLES | DHB (1-Test Cyp) | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 1TT10 | DHB (1-Test Cyp) | OILS / INJECTABLES | DHB (1-Test Cyp) | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 2AD | AOD9604 | PEPTIDES | AOD9604 | 2mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| 2S10 | SS-31 | PEPTIDES | SS-31 | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 2S50 | SS-31 | PEPTIDES | SS-31 | 50mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 325 | T3 | ORALS | T3 | 25mcg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 340 | T3 | ORALS | T3 | 40mcg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 375 | LL37 | PEPTIDES | LL37 | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 3R225 | TriTren 225mg | BLENDS | TriTren 225mg | 225mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 440 | T4 | ORALS | T4 | 40mcg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 50AM | 5-amino-1mq | ORALS | 5-amino-1mq | 50mg/vial x 10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| 5AD | AOD9604 | PEPTIDES | AOD9604 | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| 5AM | 5-amino-1mq | ORALS | 5-amino-1mq | 5mg/vial x 10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| AA10 | AA Water | HILFSSTOFFE | AA Water | 10ml/vial x10vials | nein | ja | NON_LEXICON | Rekonstitutionsflüssigkeit (BAC/AA Water), kein Wirkstoffprofil. |
| AD5 | Adamax | PEPTIDES | Adamax | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| AE1 | ACE-031 | PEPTIDES | ACE-031 | 1mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| AI10 | AICAR | ORALS | AICAR | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| AMQ50 | 5-amino-1mq | ORALS | 5-amino-1mq | 50mg x 25tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| AP2 | Adipotide | PEPTIDES | Adipotide | 2mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| AP5 | Adipotide | PEPTIDES | Adipotide | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| AR100 | Aicar | ORALS | AICAR | 100mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| AR50 | Aicar | ORALS | AICAR | 50mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| AU100 | AHK-CU | PEPTIDES | AHK-CU | 100mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| B10F | TB-500 (FRAG) | PEPTIDES | TB-500 (FRAG) | 10mg/vial x 10vials | ja | nein | REVIEW_REQUIRED | Fragment label plus TB-500/TB4 mix; not mapped. |
| B1201 | B12 | SONSTIGE | B12 | 10ml x 1mg/ml | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| B1210 | B12 | SONSTIGE | B12 | 10ml x 10mg/ml | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| B157 | BPC157 | PEPTIDES | BPC157 | 500mcg x 100tablets | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| B300 | BLEND 300mg | BLENDS | BLEND 300mg | 300mg | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| B375 | BLEND 375mg | BLENDS | BLEND 300mg | 375mg | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| B500 | BLEND 500mg | BLENDS | BLEND 300mg | 500mg | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| B70 | COCK BOMBS | SONSTIGE | COCK BOMBS | 7mg x 100tablets | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| BA03 | BAC Water | HILFSSTOFFE | BAC Water | 3ml/vial x10vials | nein | ja | NON_LEXICON | Rekonstitutionsflüssigkeit (BAC/AA Water), kein Wirkstoffprofil. |
| BA10 | BAC Water | HILFSSTOFFE | BAC Water | 10ml/vial x10vials | nein | ja | NON_LEXICON | Rekonstitutionsflüssigkeit (BAC/AA Water), kein Wirkstoffprofil. |
| BA100 | TEST BASE (NO Ester) | OILS / INJECTABLES | TEST BASE (NO Ester) | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| BAM50 | BAM15 | ORALS | BAM15 | 50mg x 60capsule | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| BB10 | BPC157 5mg+TB500 5mg Blend | BLENDS | BPC157 5mg+TB500 5mg Blend | 10mg/vial x 10vials | ja | nein | REVIEW_REQUIRED | Two-substance blend; no blend identity slug. |
| BB20 | BPC157 10mg+TB500 10mg Blend | BLENDS | BPC157 5mg+TB500 5mg Blend | 20mg/vial x 10vials | ja | nein | REVIEW_REQUIRED | Two-substance blend; no blend identity slug. |
| BB500 | BPC 500mcg+TB500 500mcg Blend | BLENDS | BPC157 5mg+TB500 5mg Blend | 1000mcg x 100tablets | ja | nein | REVIEW_REQUIRED | Two-substance blend; no blend identity slug. |
| BBG70 | (GLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg Blend | BLENDS | (GLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg Blend | 70mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| BC10 | BPC 157 | PEPTIDES | BPC157 | 10mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| BC2 | BPC 157 | PEPTIDES | BPC157 | 2mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| BC20 | BPC 157 | PEPTIDES | BPC157 | 20mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| BC5 | BPC 157 | PEPTIDES | BPC157 | 5mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| BC500 | BPC | PEPTIDES | BPC157 | 500mcg x 60pcs | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| BM5 | Metribolone | ORALS | Metribolone | 5mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| BR20 | Bronchogen | PEPTIDES | Bronchogen | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| BR50 | Tren BASE | OILS / INJECTABLES | Tren BASE | 50mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| BS250 | BC (Boldenone Cyp) | OILS / INJECTABLES | BC (Boldenone Cyp) | 250mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| BT10 | TB-500 (Thymosin B4 Acetate) | PEPTIDES | TB-500 (Thymosin B4 Acetate) | 10mg/vial x 10vials | ja | nein | REVIEW_REQUIRED | Shop label mixes TB-500 and Thymosin Beta-4; identities stay separate. |
| BT20 | TB-500 (Thymosin B4 Acetate) | PEPTIDES | TB-500 (Thymosin B4 Acetate) | 20mg/vial x 10vials | ja | nein | REVIEW_REQUIRED | Shop label mixes TB-500 and Thymosin Beta-4; identities stay separate. |
| BT5 | TB-500 (Thymosin B4 Acetate) | PEPTIDES | TB-500 (Thymosin B4 Acetate) | 5mg/vial x 10vials | ja | nein | REVIEW_REQUIRED | Shop label mixes TB-500 and Thymosin Beta-4; identities stay separate. |
| C250 | TEST CYPIONATE | OILS / INJECTABLES | TEST CYPIONATE | 250mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CA20 | Cardiogen | PEPTIDES | Cardiogen | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CB40 | CLENBUTEROL | ORALS | CLENBUTEROL | 40mcg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CBL60 | Cerebrolysin | SONSTIGE | Cerebrolysin | 60mg/vial x 6 vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CD10 | CJC-1295 With DAC | PEPTIDES | CJC-1295 With DAC | 10mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| CD2 | CJC-1295 With DAC | PEPTIDES | CJC-1295 With DAC | 2mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| CD5 | CJC-1295 With DAC | PEPTIDES | CJC-1295 With DAC | 5mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| CD50 | Clomiphene | ORALS | Clomiphene | 50mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CG25 | Cabergoline | ORALS | Cabergoline | 0.25mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CGL10 | Cagrilintide | PEPTIDES | Cagrilintide | 10mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| CGL20 | Cagrilintide | PEPTIDES | Cagrilintide | 20mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| CGL5 | Cagrilintide | PEPTIDES | Cagrilintide | 5mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| CND10 | CJC-1295 Without DAC | PEPTIDES | CJC-1295 With DAC | 10mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| CND2 | CJC-1295 Without DAC | PEPTIDES | CJC-1295 With DAC | 2mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| CND5 | CJC-1295 Without DAC | PEPTIDES | CJC-1295 With DAC | 5mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| COR20 | Cortagen | PEPTIDES | Cortagen | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CP10 | CJC-1295 without DAC 5mg + IPA 5mg Blend | BLENDS | CJC-1295 without DAC 5mg + IPA 5mg Blend | 10mg/vial x 10vials | ja | nein | REVIEW_REQUIRED | Two-substance blend. |
| CP20 | CJC-1295 without DAC 10mg + IPA 10mg | BLENDS | CJC-1295 without DAC 5mg + IPA 5mg Blend | 20mg/vial x 10vials | ja | nein | REVIEW_REQUIRED | Two-substance blend. |
| CRY20 | Crystagen | PEPTIDES | Crystagen | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CS10 | Cagrilintide 5mg+Semaglutide 5mg Blend | BLENDS | Cagrilintide 5mg+Semaglutide 5mg Blend | 10mg/vial x 10vials | ja | nein | REVIEW_REQUIRED | Two-substance blend; do not pick one INN. |
| CT10 | Turinabol | ORALS | Turinabol | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CT25 | Turinabol | ORALS | Turinabol | 25mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CT50 | Turinabol | ORALS | Turinabol | 50mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| CU100 | GHK-CU | PEPTIDES | GHK-CU | 100mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| CU50 | GHK-CU | PEPTIDES | GHK-CU | 50mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| D10 | DIANABOL | ORALS | DIANABOL | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| D100 | Mast P (DP) | OILS / INJECTABLES | Mast P (DP) | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| D20 | DIANABOL | ORALS | DIANABOL | 20mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| D200 | Mast E (DE) | OILS / INJECTABLES | Mast E (DE) | 200mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| D50 | DIANABOL | ORALS | DIANABOL | 50mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DAP30 | dapoxetine | ORALS | dapoxetine | 30mg x 100pcs | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DEX1 | ARIMIDEX | ORALS | ARIMIDEX | 1mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DHA20 | Dihexa | PEPTIDES | Dihexa | 20mg x 25pcs | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DM200 | MAST Blend 200mg | BLENDS | MAST Blend 200mg | 200mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DO50 | DIANABOL (Methandranstenolone) | ORALS | DIANABOL | 50mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DR5 | Dermorphin | PEPTIDES | Dermorphin | 5mg/vial x 10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DS10 | DSIP | PEPTIDES | DSIP | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DS15 | DSIP | PEPTIDES | DSIP | 15mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DS2 | DSIP | PEPTIDES | DSIP | 2mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DS5 | DSIP | PEPTIDES | DSIP | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DT20 | Tadalafil (Cialis) | ORALS | Tadalafil (Cialis) | 20mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| DUT1 | Dutasteride | ORALS | Dutasteride | 1mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| E3K | EPO | SONSTIGE | EPO | 3000UI/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| EC100 | Estradiol Cypionate | OILS / INJECTABLES | Estradiol Cypionate | 10mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| EC25 | Androxal (Enclomiphene) | ORALS | Androxal (Enclomiphene) | 25mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| ET10 | Epithalon | PEPTIDES | Epithalon | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| ET40 | Epithalon | PEPTIDES | Epithalon | 40mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| ET50 | Epithalon | PEPTIDES | Epithalon | 50mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| EX25 | Aromasin (Exemestane) | ORALS | Aromasin (Exemestane) | 25mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| F410 | FOXO4 | PEPTIDES | FOXO4 | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| FM2 | MGF | PEPTIDES | MGF | 2mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| FMP2 | PEG MGF | PEPTIDES | PEG MGF | 2mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| FNA1 | Finasteride | ORALS | Finasteride | 1mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| FR10 | HGH Fragment 176-191 | PEPTIDES | HGH Fragment 176-191 | 10mg/vial x 10 vials | ja | nein | REVIEW_REQUIRED | Fragment is not somatropin. |
| FR2 | HGH Fragment 176-191 | PEPTIDES | HGH Fragment 176-191 | 2mg/vial x 10 vials | ja | nein | REVIEW_REQUIRED | Fragment is not somatropin. |
| FR5 | HGH Fragment 176-191 | PEPTIDES | HGH Fragment 176-191 | 5mg/vial x 10 vials | ja | nein | REVIEW_REQUIRED | Fragment is not somatropin. |
| FS5 | Finasteride | ORALS | Finasteride | 5mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| FX10 | Fluoxymesterone (Halotestin) | ORALS | Fluoxymesterone (Halotestin) | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| G10K | HCG | PEPTIDES | HCG | 10000IU/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| G210 | GHRP-2 Acetate | PEPTIDES | GHRP-2 Acetate | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| G25 | GHRP-2 Acetate | PEPTIDES | GHRP-2 Acetate | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| G2K | HCG | PEPTIDES | HCG | 2000IU/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| G50 | GW-501516 (Cardarine) | ORALS | GW-501516 (Cardarine) | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| G5K | HCG | PEPTIDES | HCG | 5000IU/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| G610 | GHRP-6 Acetate | PEPTIDES | GHRP-6 Acetate | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| G65 | GHRP-6 Acetate | PEPTIDES | GHRP-6 Acetate | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| G75 | HMG | PEPTIDES | HMG | 75IU/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| GGH | GGH | SONSTIGE | GGH | blend | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| GND2 | Gonadorelin | PEPTIDES | Gonadorelin | 2mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| GTT | Glutathione | SONSTIGE | Glutathione | 1500mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| H06 | HGH | PEPTIDES | HGH | 6iu/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| H10 | HGH | PEPTIDES | HGH | 10iu/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| H100 | Tren Hex | OILS / INJECTABLES | Tren Hex | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| H12 | HGH | PEPTIDES | HGH | 12iu/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| H15 | HGH | PEPTIDES | HGH | 15iu/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| H24 | HGH | PEPTIDES | HGH | 24iu/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| H36 | HGH | PEPTIDES | HGH | 36iu/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| H50 | HGH | PEPTIDES | HGH | 50iu/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| HA5 | Hyaluronic acid | SONSTIGE | Hyaluronic acid | 5mg/vial x1vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| HD50 | DHT (Stanolone) | OILS / INJECTABLES | DHT (Stanolone) | 50mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| HHB | HHB | SONSTIGE | HHB | blend | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| HU10 | Humanin | PEPTIDES | Humanin | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| HX2 | Hexarelin | PEPTIDES | Hexarelin | 2mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| HX5 | Hexarelin | PEPTIDES | Hexarelin | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| HYD200 | Hydroxychloroquine | ORALS | Hydroxychloroquine | 200mg x 60capsule | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| IG01 | IGF-1LR3 | PEPTIDES | IGF-1LR3 | 0.1mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| IG1 | IGF-1LR3 | PEPTIDES | IGF-1LR3 | 1mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| IP10 | Ipamorelin | PEPTIDES | Ipamorelin | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| IP2 | Ipamorelin | PEPTIDES | Ipamorelin | 2mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| IP5 | Ipamorelin | PEPTIDES | Ipamorelin | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| ISO10 | isotretinoin | ORALS | isotretinoin | 10mg x 100pcs | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| KL80 | (KLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg+TB500 10mg Blend | BLENDS | (KLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg+TB500 10mg Blend | 80mg/vial x10vials | ja | nein | REVIEW_REQUIRED | Klow is not the glow-blend identity (extra TB-500). |
| KP10 | KPV | PEPTIDES | KPV | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| KP5 | KPV | PEPTIDES | KPV | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| KP500 | KPV | PEPTIDES | KPV | 500mcg x 100tablets | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| KS10 | KissPeptin-10 | PEPTIDES | KissPeptin-10 | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| KS5 | KissPeptin-10 | PEPTIDES | KissPeptin-10 | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| LAX20 | Cartalax | PEPTIDES | Cartalax | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| LC500 | LC500 | SONSTIGE | LC500 | 500mg | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| LC526 | LC526 | SONSTIGE | LC500 | various | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| LC653 | LC653 | SONSTIGE | LC500 | various | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| LGD | LGD-4033 (Ligandrol) | ORALS | LGD-4033 (Ligandrol) | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| LI20 | Livagen | PEPTIDES | Livagen | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| LL10 | Liraglutide | PEPTIDES | Liraglutide | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| LL30 | Liraglutide | PEPTIDES | Liraglutide | 30mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| LL5 | Liraglutide | PEPTIDES | Liraglutide | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| LV5 | Ivermectin | ORALS | Ivermectin | 5mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| LZ25 | Letrozole | ORALS | Letrozole | 2.5mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| M100 | Primobolan E | OILS / INJECTABLES | Primobolan E | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| M1T10 | 17a-Methyl-1-testosterone | ORALS | 17a-Methyl-1-testosterone | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| M200 | Primobolan E | OILS / INJECTABLES | Primobolan E | 200mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| M25 | Methenolone Acetate (Primobolan) | OILS / INJECTABLES | Methenolone Acetate (Primobolan) | 25mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| M28 | Ostarine / MK-2866 | ORALS | Ostarine / MK-2866 | 25mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| M40 | Methenolone Acetate (Primobolan) | OILS / INJECTABLES | Methenolone Acetate (Primobolan) | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| M50 | Methenolone Acetate (Primobolan) | OILS / INJECTABLES | Methenolone Acetate (Primobolan) | 50mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| M6 | MK-677 (Ibutamoren) | ORALS | MK-677 (Ibutamoren) | 10mg x 100pcs | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| MA10 | Matrixyl | PEPTIDES | Matrixyl | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| MAX20 | Prostamax | PEPTIDES | Prostamax | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| MB20 | Methylene Blue | ORALS | Methylene Blue | 20mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| MD5 | Minoxidil | ORALS | Minoxidil | 5mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| MDT10 | Mazdutide | PEPTIDES | Mazdutide | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| MDT5 | Mazdutide | PEPTIDES | Mazdutide | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| ML10 | MT-2 (Melanotan 2 Acetate) | PEPTIDES | MT-2 (Melanotan 2 Acetate) | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| MN50 | MENT (Testosterone Acetate) | OILS / INJECTABLES | MENT (Testosterone Acetate) | 50mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| MS10 | MOTS-C | PEPTIDES | MOTS-C | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| MS40 | MOTS-C | PEPTIDES | MOTS-C | 40mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| MSB10 | Methylstenbolone | ORALS | Methylstenbolone | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| MT1 | MT-1 | PEPTIDES | MT-1 | 10mg/vial x10vials | ja | nein | REVIEW_REQUIRED | Melanotan I is not Melanotan II; prefix ^MT[0-9] must not stand. |
| N200 | DECA (ND) | OILS / INJECTABLES | DECA (ND) | 200mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| N300 | DECA (ND) | OILS / INJECTABLES | DECA (ND) | 300mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NET10 | N-Acetyl Epitalon Amidate | PEPTIDES | N-Acetyl Epitalon Amidate | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NET5 | N-Acetyl Epitalon Amidate | PEPTIDES | N-Acetyl Epitalon Amidate | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NJ100 | NAD+ | PEPTIDES | NAD+ | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NJ1000 | NAD+ | PEPTIDES | NAD+ | 1000mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NJ250 | NAD+ | PEPTIDES | NAD+ | 250mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NJ3100 | NAD+ | PEPTIDES | NAD+ | 100mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NJ500 | NAD+ | PEPTIDES | NAD+ | 500mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NM300 | NANDROMIX 300mg | BLENDS | NANDROMIX 300mg | 300mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NP810 | SNAP-8 | PEPTIDES | SNAP-8 | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| NSK30 | NA Selank amide | PEPTIDES | NA Selank amide | 30mg/vial x10vials | ja | nein | REVIEW_REQUIRED | Modified analogue; not mapped to selank without a separate identity. |
| NXA30 | NA Semax amide | PEPTIDES | NA Semax amide | 30mg/vial x10vials | ja | nein | REVIEW_REQUIRED | Modified analogue; not mapped to semax without a separate identity. |
| ORF12 | Orforglipron | ORALS | Orforglipron | 12mg x 100pcs | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| ORF6 | Orforglipron | ORALS | Orforglipron | 6mg x 100pcs | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| OT10 | Oxytocin Acetate | PEPTIDES | Oxytocin Acetate | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| OT2 | Oxytocin Acetate | PEPTIDES | Oxytocin Acetate | 2mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| OT5 | Oxytocin Acetate | PEPTIDES | Oxytocin Acetate | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| OV20 | Ovagen | PEPTIDES | Ovagen | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| OXO50 | ANADROL (Oxymetholone) | ORALS | ANADROL (Oxymetholone) | 50mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| OXP50 | ANADROL | ORALS | ANADROL (Oxymetholone) | 50mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| P10 | Proviron | ORALS | Proviron | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| P100 | TEST P | OILS / INJECTABLES | TEST P | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| P200 | TEST P | OILS / INJECTABLES | TEST P | 200mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| P210 | P21 | PEPTIDES | P21 | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| P25 | Proviron | ORALS | Proviron | 25mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| P41 | PT-141 | PEPTIDES | PT-141 | 10mg/vial x 10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PA20 | Pancragen | PEPTIDES | Pancragen | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PBN40 | Prednisone | ORALS | Prednisone | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PE10 | PE 22-28 | PEPTIDES | PE 22-28 | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PIN10 | Pinealon | PEPTIDES | Pinealon | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PIN20 | Pinealon | PEPTIDES | Pinealon | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PIN5 | Pinealon | PEPTIDES | Pinealon | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PN10 | PNC 27 | PEPTIDES | PNC 27 | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PN100 | NPP | OILS / INJECTABLES | NPP | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PN200 | NPP | OILS / INJECTABLES | NPP | 200mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PN5 | PNC 27 | PEPTIDES | PNC 27 | 5mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PND | DNP | ORALS | DNP | 250mg x 25tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| PRO20 | Aprostadil | SONSTIGE | Aprostadil | 20mcg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| R100 | Tren A | OILS / INJECTABLES | Tren A | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| R14 | RAD140 | ORALS | RAD140 | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| R200 | Tren E | OILS / INJECTABLES | Tren E | 200mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| RA10 | ARA-290 | PEPTIDES | ARA-290 | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| RC10 | Retatrutide 5mg+Cagrilintide 5mg Blend | BLENDS | Retatrutide 5mg+Cagrilintide 5mg Blend | 10mg/vial x10vials | ja | nein | REVIEW_REQUIRED | Two-substance blend; do not pick one INN. |
| RM200 | TRENMIX 200mg | BLENDS | TRENMIX 200mg | 200mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| RT10 | Retatrutide | PEPTIDES | Retatrutide | 10mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| RT100 | Retatrutide | PEPTIDES | Retatrutide | 100mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| RT15 | Retatrutide | PEPTIDES | Retatrutide | 15mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| RT20 | Retatrutide | PEPTIDES | Retatrutide | 20mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| RT30 | Retatrutide | PEPTIDES | Retatrutide | 30mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| RT40 | Retatrutide | PEPTIDES | Retatrutide | 40mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| RT5 | Retatrutide | PEPTIDES | Retatrutide | 5mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| RT50 | Retatrutide | PEPTIDES | Retatrutide | 50mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| RT60 | Retatrutide | PEPTIDES | Retatrutide | 60mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| RX225 | RIPEX | SONSTIGE | RIPEX | 225mg | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| RY100 | Tren E | OILS / INJECTABLES | Tren E | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| S040 | Andarine S4 | ORALS | Andarine S4 | 25mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| S250 | Sustanon 250mg | BLENDS | Sustanon 250mg | 250mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| S400 | Sustanon 400mg | BLENDS | Sustanon 250mg | 400mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| S450 | Supertest 450mg | BLENDS | Supertest 450mg | 450mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| S9 | SR9009 | ORALS | SR9009 | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SB20 | SALBUTAMOL | ORALS | SALBUTAMOL | 20mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SB300 | slupp-332 250mcg+BAM15 50mcg | BLENDS | slupp-332 250mcg+BAM15 50mcg | 300mcg x 60pcs | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SD10 | Superdrol | ORALS | Superdrol | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SD100 | Sildenafil (Viagra) | ORALS | Sildenafil (Viagra) | 100mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SDO50 | Superdrol (Methyldrostanolone) | ORALS | Superdrol | 50mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SHB | SHB | SONSTIGE | SHB | blend | nein | nein | UNKNOWN | Shopbezeichnung ohne identifizierbaren Wirkstoff. |
| SK10 | Selank | PEPTIDES | Selank | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SK30 | Selank | PEPTIDES | Selank | 30mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SK5 | Selank | PEPTIDES | Selank | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SL100 | SLU-PP-332 | PEPTIDES | SLU-PP-332 | 100mg x 60tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SL50 | SLU-PP-332 | PEPTIDES | SLU-PP-332 | 50mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SLU1000 | SLU-PP-332 | PEPTIDES | SLU-PP-332 | 1mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SLU20 | SLU-PP-332 | PEPTIDES | SLU-PP-332 | 20mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SLU250 | SLU-PP-332 | PEPTIDES | SLU-PP-332 | 250mcg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SLU5 | SLU-PP-332 | PEPTIDES | SLU-PP-332 | 5mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SLU500 | SLU-PP-332 | PEPTIDES | SLU-PP-332 | 500mcg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SM10 | Semaglutide | PEPTIDES | Semaglutide | 10mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SM15 | Semaglutide | PEPTIDES | Semaglutide | 15mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SM2 | Semaglutide | PEPTIDES | Semaglutide | 2mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SM20 | Semaglutide | PEPTIDES | Semaglutide | 20mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SM30 | Semaglutide | PEPTIDES | Semaglutide | 30mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SM5 | Semaglutide | PEPTIDES | Semaglutide | 5mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SM500 | Semaglutide | PEPTIDES | Semaglutide | 500mcg x 25tablets | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SMM3 | Semaglutide | PEPTIDES | Semaglutide | 3mg x 25pcs | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SMM7 | Semaglutide | PEPTIDES | Semaglutide | 7mg x 25pcs | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SMO10 | Sermorelin Acetate | PEPTIDES | Sermorelin Acetate | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SMO15 | Sermorelin Acetate | PEPTIDES | Sermorelin Acetate | 15mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SMO5 | Sermorelin Acetate | PEPTIDES | Sermorelin Acetate | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| SO100 | STANOZOLOL (Oil base) winstrol | OILS / INJECTABLES | STANOZOLOL (Oil base) winstrol | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SO50 | STANOZOLOL (Oil base) winstrol | OILS / INJECTABLES | STANOZOLOL (Oil base) winstrol | 50mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SP100 | TEST SUSPENSION 100mg | OILS / INJECTABLES | TEST SUSPENSION 100mg | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SW100 | STANOZOLOL (Water) winstrol | OILS / INJECTABLES | STANOZOLOL (Water) winstrol | 100mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| SW50 | STANOZOLol (Water) winstrol | OILS / INJECTABLES | STANOZOLOL (Water) winstrol | 50mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| T20 | Tamoxifen (Nolvadex) | ORALS | Tamoxifen (Nolvadex) | 20mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| T500 | Tesofensine | ORALS | Tesofensine | 500mcg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| T600 | Testo 600mg | OILS / INJECTABLES | Testo 600mg | 600mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| TA10 | Thymosin Alpha-1 | PEPTIDES | Thymosin Alpha-1 | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TA5 | Thymosin Alpha-1 | PEPTIDES | Thymosin Alpha-1 | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TE250 | TEST ENANTHATE | OILS / INJECTABLES | TEST ENANTHATE | 250mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| TE300 | TEST ENANTHATE | OILS / INJECTABLES | TEST ENANTHATE | 300mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| TER10 | Teriparatide | PEPTIDES | Teriparatide | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| TG20 | Testagen | PEPTIDES | Testagen | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| TI18 | Tesamorelin 12mg+Ipamorelin 6mg | BLENDS | Tesamorelin 12mg+Ipamorelin 6mg | 18mg/vial x10vials | ja | nein | REVIEW_REQUIRED | Two-substance blend. |
| TM40 | Telmisartan | ORALS | Telmisartan | 40mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| TR10 | Tirzepatide | PEPTIDES | Tirzepatide | 10mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR100 | Tirzepatide | PEPTIDES | Tirzepatide | 100mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR120 | Tirzepatide | PEPTIDES | Tirzepatide | 120mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR15 | Tirzepatide | PEPTIDES | Tirzepatide | 15mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR20 | Tirzepatide | PEPTIDES | Tirzepatide | 20mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR30 | Tirzepatide | PEPTIDES | Tirzepatide | 30mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR40 | Tirzepatide | PEPTIDES | Tirzepatide | 40mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR5 | Tirzepatide | PEPTIDES | Tirzepatide | 5mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR50 | Tirzepatide | PEPTIDES | Tirzepatide | 50mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR500 | Tirzepatide | PEPTIDES | Tirzepatide | 500mcg x 25tablets | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TR60 | Tirzepatide | PEPTIDES | Tirzepatide | 60mg/vial x 10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TSM10 | Tesamorelin | PEPTIDES | Tesamorelin | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TSM20 | Tesamorelin | PEPTIDES | Tesamorelin | 20mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TSM5 | Tesamorelin | PEPTIDES | Tesamorelin | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| TY10 | Thymalin | PEPTIDES | Thymalin | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| TY300 | TEST Undecanoate 300 | OILS / INJECTABLES | TEST Undecanoate 300 | 300mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| U200 | BU (EQUIPOISE) | OILS / INJECTABLES | BU (EQUIPOISE) | 200mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| U300 | BU (EQUIPOISE) | OILS / INJECTABLES | BU (EQUIPOISE) | 300mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| U600 | BU (EQUIPOISE) | OILS / INJECTABLES | BU (EQUIPOISE) | 600mg | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| VE20 | Vesugen | PEPTIDES | Vesugen | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| VI20 | Vilon | PEPTIDES | Vilon | 20mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| VP10 | VIP | PEPTIDES | VIP | 10mg/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| W10 | Winstrol (Stanozolol) | ORALS | Winstrol (Stanozolol) | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| W20 | Winstrol (Stanozolol) | ORALS | Winstrol (Stanozolol) | 20mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| W50 | Winstrol (Stanozolol) | ORALS | Winstrol (Stanozolol) | 50mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| X10 | ANAVAR | ORALS | ANAVAR | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| X25 | ANAVAR | ORALS | ANAVAR | 25mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| X50 | ANAVAR | ORALS | ANAVAR | 50mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| XA10 | Semax | PEPTIDES | Semax | 10mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| XA30 | Semax | PEPTIDES | Semax | 30mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| XA5 | Semax | PEPTIDES | Semax | 5mg/vial x10vials | ja | ja | COMPLETE | Sicher der vorhandenen Research-Identität zugeordnet. |
| XS20 | Semax 10mg+Selank 10mg | BLENDS | Semax 10mg+Selank 10mg | 20mg/vial x10vials | ja | nein | REVIEW_REQUIRED | Two-substance blend. |
| XT100 | Botulinum toxin | SONSTIGE | Botulinum toxin | 100iu/vial x10vials | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |
| Y1 | YK11 | ORALS | YK11 | 10mg x 100tablets | ja | ja | PARTIAL | Identifizierbarer Katalogeintrag ohne vollständiges wissenschaftliches Profil. |

