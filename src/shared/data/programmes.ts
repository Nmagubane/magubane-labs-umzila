/**
 * University and college programmes with their published minimum requirements.
 * Rule: a row exists only if we read it in a source. Anything we were unsure of carries `review`, and the app shows it.
 * Minimums are minimums: meeting them never guarantees a place, and the app always says so.
 */
import type { SourceId } from './sources.ts';
import type { SubjectId } from './subjects.ts';

export type InstitutionId = 'up' | 'ukzn' | 'mut' | 'tut';

export interface Institution {
  id: InstitutionId;
  name: string;
  short: string;
  kind: 'university' | 'university-of-technology';
  /** How this institution counts its Admission Point Score (APS), when we know it. */
  aps?: { method: 'best6-excl-lo'; max: 42; note: string };
  website: string;
}

export const INSTITUTIONS: Record<InstitutionId, Institution> = {
  up: {
    id: 'up',
    name: 'University of Pretoria',
    short: 'UP',
    kind: 'university',
    aps: { method: 'best6-excl-lo', max: 42, note: 'Six 20-credit subjects on the 1–7 scale. Life Orientation is not counted.' },
    website: 'https://www.up.ac.za',
  },
  ukzn: { id: 'ukzn', name: 'University of KwaZulu-Natal', short: 'UKZN', kind: 'university', website: 'https://www.ukzn.ac.za' },
  mut: { id: 'mut', name: 'Mangosuthu University of Technology', short: 'MUT', kind: 'university-of-technology', website: 'https://www.mut.ac.za' },
  tut: {
    id: 'tut',
    name: 'Tshwane University of Technology',
    short: 'TUT',
    kind: 'university-of-technology',
    aps: { method: 'best6-excl-lo', max: 42, note: 'Reported as excluding Life Orientation. Check TUT’s own calculator.' },
    website: 'https://www.tut.ac.za',
  },
};

export interface SubjectRequirement {
  /** Any one of these subjects satisfies the requirement. */
  anyOf: SubjectId[];
  minPercent: number;
}

export interface Programme {
  id: string;
  institution: InstitutionId;
  name: string;
  award: 'degree' | 'diploma';
  years: number;
  /** The academic year these requirements are for. */
  intake: number;
  aps?: number;
  /** An NSC endorsement the programme asks for explicitly (most degrees need a Bachelor's pass in any case). */
  pass?: 'bachelor' | 'diploma';
  subjects: SubjectRequirement[];
  notes: string[];
  source: SourceId;
  /** Something we could not confirm from the source. Shown to the learner. */
  review?: string;
}

const ENG = (p: number): SubjectRequirement => ({ anyOf: ['english'], minPercent: p });
const MATHS = (p: number): SubjectRequirement => ({ anyOf: ['maths'], minPercent: p });
const PHYS = (p: number): SubjectRequirement => ({ anyOf: ['physical-sciences'], minPercent: p });
const LIFE = (p: number): SubjectRequirement => ({ anyOf: ['life-sciences'], minPercent: p });

const SELECTION = 'Meeting the minimum lets you apply. Places are limited and selection is competitive.';

const up = (id: string, name: string, years: number, aps: number, subjects: SubjectRequirement[], notes: string[] = [], extra: Partial<Programme> = {}): Programme => ({
  id: `up-${id}`,
  institution: 'up',
  name,
  award: 'degree',
  years,
  intake: 2027,
  aps,
  subjects,
  notes: [SELECTION, ...notes],
  source: 'up-prospectus-2027',
  ...extra,
});

export const PROGRAMMES: Programme[] = [
  // Health sciences (UP)
  up('mbchb', 'Bachelor of Medicine and Surgery (MBChB)', 6, 35, [ENG(60), MATHS(70), PHYS(60)], ['UP closed applications for the 2027 intake on 30 June 2026.'], { source: 'up-mbchb-2027' }),
  up('bds', 'Bachelor of Dental Surgery', 5, 35, [ENG(60), MATHS(70), PHYS(60)]),
  up('physio', 'Bachelor of Physiotherapy', 4, 30, [ENG(50), MATHS(50), PHYS(50)]),
  up('brad', 'Bachelor of Radiography in Diagnostics', 4, 30, [ENG(50), MATHS(50), PHYS(50)]),
  up('nursing', 'Bachelor of Nursing Science', 4, 28, [ENG(50), MATHS(50), LIFE(50)], [], {
    review: 'The prospectus row is laid out unusually. Confirm the Life Sciences level in the UP prospectus.',
  }),
  up('bvsc', 'Bachelor of Veterinary Science', 6, 35, [ENG(60), MATHS(60), PHYS(60)], [
    'The only veterinary faculty in South Africa (Onderstepoort). Applications close earlier than other UP programmes.',
  ]),

  // Engineering (UP)
  up('beng-civil', 'BEng Civil Engineering', 4, 35, [ENG(60), MATHS(70), PHYS(70)], [], { source: 'up-civil-2026-yearbook' }),
  up('beng-electrical', 'BEng Electrical Engineering', 4, 35, [ENG(60), MATHS(70), PHYS(70)]),
  up('beng-mechanical', 'BEng Mechanical Engineering', 4, 35, [ENG(60), MATHS(70), PHYS(70)]),
  up('beng-chemical', 'BEng Chemical Engineering', 4, 35, [ENG(60), MATHS(70), PHYS(70)]),
  up('beng-mining', 'BEng Mining Engineering', 4, 35, [ENG(60), MATHS(70), PHYS(70)]),
  up('beng-5yr', 'BEng, 5-year programme (any discipline)', 5, 33, [ENG(65), MATHS(65), PHYS(65)], [
    'The same degree with an extra foundation year. Previously called ENGAGE.',
  ], { source: 'up-civil-2026-yearbook' }),

  // Built environment (UP)
  up('bsc-qs', 'BSc Quantity Surveying', 3, 30, [ENG(60), MATHS(60)], [], {
    review: 'The prospectus row mentions Accounting as an alternative and a further level 4. Check the exact rule in the UP prospectus.',
  }),
  up('bsc-arch', 'BSc Architecture', 3, 30, [ENG(60), MATHS(50), PHYS(50)], ['Only considered as a first choice. Selection includes an additional assessment.']),

  // Commerce and mathematical sciences (UP)
  up('bcom-acc', 'BCom Accounting Sciences', 3, 34, [ENG(60), MATHS(70)]),
  up('bsc-actuarial', 'BSc Actuarial and Financial Mathematics', 3, 36, [ENG(60), MATHS(80)]),
  up('bsc-stats', 'BSc Mathematical Statistics', 3, 34, [ENG(60), MATHS(70)]),
  up('bsc-cs', 'BSc Computer Science', 3, 30, [ENG(60), MATHS(70)]),
  up('bsc-it-iks', 'BSc Information Technology (Information and Knowledge Systems)', 3, 30, [ENG(50), MATHS(70)]),
  up('bsc-geology', 'BSc Geology', 3, 34, [ENG(60), MATHS(60), PHYS(60)]),

  // Education, law, humanities (UP)
  up('bed-fet-science', 'BEd Senior Phase and FET Teaching (Physical or Life Sciences subjects)', 4, 28, [ENG(50), MATHS(60), PHYS(60)], [
    'To take Physical or Life Sciences as teaching subjects, UP asks for Mathematics and Physical Sciences at level 5.',
  ]),
  up('llb', 'Bachelor of Laws (LLB)', 4, 35, [ENG(70)]),
  up('ba', 'Bachelor of Arts (major in Psychology)', 3, 30, [ENG(60)], ['Psychology is a major inside the BA.']),

  // Pharmacy (UKZN)
  {
    id: 'ukzn-bpharm',
    institution: 'ukzn',
    name: 'Bachelor of Pharmacy',
    award: 'degree',
    years: 4,
    intake: 2027,
    pass: 'bachelor',
    subjects: [ENG(50), { anyOf: ['life-orientation'], minPercent: 50 }, MATHS(50), LIFE(50), PHYS(50)],
    notes: [SELECTION, 'Only considered as choice 1, 2 or 3 on your application.', 'UKZN lists 30 September as the closing date.'],
    source: 'ukzn-bpharm',
  },

  // Engineering diploma (MUT, via SAQA)
  {
    id: 'mut-dip-civil',
    institution: 'mut',
    name: 'Diploma in Civil Engineering',
    award: 'diploma',
    years: 3,
    intake: 2027,
    subjects: [ENG(50), MATHS(50), PHYS(50)],
    notes: [SELECTION, 'Trains civil engineering technicians who can register with ECSA.'],
    source: 'saqa-mut-civil-diploma',
    review: 'These are the minimums registered with SAQA. MUT may add an APS or rank applicants. Check MUT’s 2027 prospectus.',
  },

  // TUT (secondary source until checked against TUT's prospectus)
  {
    id: 'tut-dip-cs',
    institution: 'tut',
    name: 'Diploma in Computer Science',
    award: 'diploma',
    years: 3,
    intake: 2027,
    aps: 26,
    subjects: [ENG(50), { anyOf: ['maths', 'tech-maths'], minPercent: 60 }],
    notes: [SELECTION],
    source: 'tut-2027-secondary',
    review: 'From a third-party summary. Check the TUT 2027 prospectus.',
  },
  {
    id: 'tut-bnursing',
    institution: 'tut',
    name: 'Bachelor of Nursing',
    award: 'degree',
    years: 4,
    intake: 2027,
    aps: 27,
    subjects: [ENG(50), { anyOf: ['maths', 'tech-maths'], minPercent: 50 }, LIFE(50), PHYS(50)],
    notes: [SELECTION],
    source: 'tut-2027-secondary',
    review: 'From a third-party summary. Check the TUT 2027 prospectus.',
  },
];

export const programmeById = (id: string): Programme | undefined => PROGRAMMES.find((p) => p.id === id);
