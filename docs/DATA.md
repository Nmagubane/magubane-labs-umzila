# Career data: what we have, where it came from, what to check

Read on 6 November 2026. The data lives in `src/shared/data/`. Every learner-facing requirement shows its source in the app, and `/sources` lists everything still to confirm.

## Coverage
- **25 careers** across health, engineering, built environment, commerce, computing, earth science, teaching, law and psychology, and two trades. Chosen mostly from DHET's 2024 National List of Occupations in High Demand, plus careers learners ask about most (law, architecture, dentistry).
- **27 programme rows**: University of Pretoria (2027 prospectus, the main source), UKZN (BPharm), MUT (Diploma in Civil Engineering via SAQA), TUT (two rows, secondary source).
- **Funding:** NSFAS, Funza Lushaka, SAICA Thuthuka.

## Primary sources
| What | Source |
|---|---|
| UP requirements, APS method | UP *Undergraduate prospectus 2027: Applicants with an NSC/IEB Certificate* (read from the UniApplyForMe-hosted copy) and UP's programme pages |
| UP MBChB (5/6/5, APS 35, closes 30 June 2026) | up.ac.za programme page, 2027 |
| UP BEng 4-year (5/6/6, APS 35) and 5-year (65%/65%/65%, APS 33) | UP 2026 yearbook, Civil Engineering |
| UKZN BPharm (NSC degree pass; English, LO, Maths, Life Sci, Phys Sci at level 4; choices 1–3; closes 30 Sept) | chs.ukzn.ac.za |
| Diploma in Civil Engineering (English, Maths, Phys Sci at 4) | SAQA qualification 96855 (MUT) |
| Grade 10 subject rules | DBE "Subject choice and career pathing" |
| Bachelor's pass rules | WCED NSC results page (designated subject list revoked 2018) |
| Occupations in high demand | DHET Gazette 50510, April 2024 |
| Artisan entry (≥ 40% Maths, not Maths Lit; Grade 9 or NC(V) L2) | Vuk'uzenzele (GCIS) |
| NSFAS thresholds (R350 000; R600 000 with disability) | Rhodes University Registrar page quoting NSFAS |

## Secondary sources (must be confirmed)
| Row | Why it's flagged | Confirm against |
|---|---|---|
| TUT Diploma in Computer Science (APS 26, English 4, Maths/Tech Maths 5) | third-party summary | TUT 2027 prospectus |
| TUT Bachelor of Nursing (APS 27, English 4, Maths/Tech Maths 4, Life Sci 4, Phys Sci 4) | third-party summary | TUT 2027 prospectus |
| Funza Lushaka 2027 dates (opened 1 Oct 2026; new applicants close 31 Jan 2027) | summary | funzalushaka.doe.gov.za |
| Thuthuka 2027 (closed 31 Aug 2026; 60% Maths in Grade 11; NBT) | summary | SAICA |
| UP and UJ 2027 closing dates (30 June; 31 October) | summaries | UP and UJ application pages |

## Rows with a `review` note
- **UP Bachelor of Nursing Science:** the prospectus row is laid out unusually; confirm Life Sciences at level 4.
- **UP BSc Quantity Surveying:** the row mentions Accounting as an alternative and an extra "4"; confirm the exact Mathematics/Accounting rule.
- **MUT Diploma in Civil Engineering:** SAQA minimums only; MUT may add an APS or ranking.

## How the UP rows were read
The prospectus was read through a web tool, not downloaded (the build environment has no direct internet). Rows were copied verbatim as "programme [years] English Maths PhysSci APS" and spot-checked against two official UP pages (MBChB 2027 and the Civil Engineering yearbook), which matched. **Before launch, open the PDF and tick each UP row by hand.** It takes about 30 minutes.

## Yearly update (each February–April)
1. Download the new prospectus for each institution.
2. Update `programmes.ts`: `intake`, minimums, notes, closing dates.
3. Update `funding.ts` `lastCycle` lines.
4. Run `npm test` (integrity tests catch broken links between careers, programmes and sources).
5. Update the `checked` date in `sources.ts`.
