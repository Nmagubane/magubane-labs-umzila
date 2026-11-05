/**
 * The career library. Each entry answers the questions a Grade 9 learner and their parents actually ask:
 * what is the work, what jobs does it lead to, which school subjects keep it open, how long is the route, and what if plan A fails.
 *
 * `school.needs` is the rule the subject checker enforces:
 * - essential: every programme we checked requires it. Without it, the usual route is closed.
 * - recommended: helps a lot, or some institutions require it.
 */
import type { SourceId } from './sources.ts';
import type { SubjectId } from './subjects.ts';

export type FieldId = 'health' | 'engineering' | 'built' | 'commerce' | 'ict' | 'science' | 'education' | 'law-society' | 'trades';

export const FIELDS: Record<FieldId, { name: string; blurb: string }> = {
  health: { name: 'Health', blurb: 'Diagnose, treat and care for people and animals' },
  engineering: { name: 'Engineering', blurb: 'Design and run the systems the country depends on' },
  built: { name: 'Built environment', blurb: 'Plan, design and cost buildings and cities' },
  commerce: { name: 'Money and risk', blurb: 'Make sense of money, risk and business' },
  ict: { name: 'Computing and data', blurb: 'Build software and find meaning in data' },
  science: { name: 'Earth and science', blurb: 'Find out how the world works, and what lies under it' },
  education: { name: 'Teaching', blurb: 'Build the next generation of minds' },
  'law-society': { name: 'Law and the mind', blurb: 'Justice, rights and how people think' },
  trades: { name: 'Trades', blurb: 'Skilled hands-on work, qualified by a trade test' },
};

export type InterestId = 'helping-people' | 'fixing-building' | 'numbers' | 'computers' | 'how-things-work' | 'designing' | 'arguing-writing' | 'animals-nature' | 'explaining' | 'business';

export const INTERESTS: Record<InterestId, { label: string; example: string }> = {
  'helping-people': { label: 'Looking after people', example: 'You are the one friends come to when they are hurt or stressed' },
  'fixing-building': { label: 'Fixing and building things', example: 'You open things up to see how they work, and put them back together' },
  numbers: { label: 'Numbers and patterns', example: 'You like it when a hard maths problem finally clicks' },
  computers: { label: 'Computers and code', example: 'You want to make apps and games, not just use them' },
  'how-things-work': { label: 'How the world works', example: 'Chemistry, physics, rocks, the body: you want the why' },
  designing: { label: 'Designing spaces and things', example: 'You sketch, plan and notice how buildings and objects are made' },
  'arguing-writing': { label: 'Arguing, reading and writing', example: 'You can make a case, and you notice when something is unfair' },
  'animals-nature': { label: 'Animals and the outdoors', example: 'You would rather be on a farm, in the veld or with animals than at a desk' },
  explaining: { label: 'Explaining things to others', example: 'You are good at helping a friend understand homework' },
  business: { label: 'Business and money', example: 'You notice prices, run a side hustle or like planning budgets' },
};

export interface SubjectNeed {
  anyOf: SubjectId[];
  kind: 'essential' | 'recommended';
  why: string;
}

export interface Station {
  kind: 'study' | 'practice' | 'exam' | 'register' | 'work';
  title: string;
  years?: number;
  detail: string;
}

export type FundingId = 'nsfas' | 'funza-lushaka' | 'thuthuka';

export interface Career {
  id: string;
  name: string;
  /** Other words learners use: "dokotela", "GP", "build bridges". Used by search. */
  aliases: string[];
  field: FieldId;
  oneLine: string;
  whatYouDo: string[];
  whereYouWork: string[];
  jobs: string[];
  interests: InterestId[];
  school: { needs: SubjectNeed[]; note?: string };
  /** Entry rule for routes without university admission tables (trades). */
  entry?: { text: string; source: SourceId };
  route: Station[];
  routeSummary: string;
  registration?: { body: string; abbr: string; title: string };
  alternatives: { title: string; detail: string; careerId?: string }[];
  programmes: string[];
  funding: FundingId[];
  /** On DHET's 2024 National List of Occupations in High Demand. manySeekers = DHET's asterisk. */
  demand?: { occupations: string[]; manySeekers?: boolean };
}

const MATHS_ESSENTIAL = (why: string): SubjectNeed => ({ anyOf: ['maths'], kind: 'essential', why });
const PHYS_ESSENTIAL = (why: string): SubjectNeed => ({ anyOf: ['physical-sciences'], kind: 'essential', why });

// Engineers share a route and requirements, so they are built from one template.
function engineer(id: string, name: string, aliases: string[], oneLine: string, whatYouDo: string[], whereYouWork: string[], jobs: string[], programme: string, demand: Career['demand'], extra: Partial<Career> = {}): Career {
  return {
    id,
    name,
    aliases: [...aliases, 'engineer', 'engineering', 'beng'],
    field: 'engineering',
    oneLine,
    whatYouDo,
    whereYouWork,
    jobs,
    interests: ['fixing-building', 'numbers', 'how-things-work'],
    school: {
      needs: [
        MATHS_ESSENTIAL('Every engineering degree requires Mathematics. UP asks for level 6 (70%). Mathematical Literacy closes this route.'),
        PHYS_ESSENTIAL('UP asks for level 6 (70%).'),
        { anyOf: ['egd'], kind: 'recommended', why: 'Technical drawing is a real advantage in first year.' },
      ],
    },
    route: [
      { kind: 'study', title: 'BEng / BSc (Eng) degree', years: 4, detail: 'An ECSA-accredited degree. There is also a 5-year option with a foundation year.' },
      { kind: 'practice', title: 'Candidate engineer', years: 3, detail: 'Training at work under a registered professional engineer.' },
      { kind: 'register', title: 'Professional engineer', detail: 'With ECSA (Pr Eng).' },
    ],
    routeSummary: '4 years study, then about 3 years of training at work',
    registration: { body: 'Engineering Council of South Africa', abbr: 'ECSA', title: 'Professional engineer (Pr Eng)' },
    alternatives: [
      { title: '5-year BEng', detail: 'The same degree with a foundation year, at lower entry marks (UP: 65% in English, Mathematics and Physical Sciences).' },
      { title: 'Engineering technician or technologist', detail: 'A diploma or BEngTech at a university of technology, with a path to further study.', careerId: 'civil-technician' },
    ],
    programmes: [programme, 'up-beng-5yr'],
    funding: ['nsfas'],
    demand,
    ...extra,
  };
}

const ENGINEERS = {
  civil: engineer(
    'civil-engineer',
    'Civil engineer',
    ['civil engineer', 'build bridges', 'bridges', 'roads', 'dams', 'structures', 'construction'],
    'Design and build the roads, bridges, dams and water systems a country runs on.',
    ['Design structures and calculate loads', 'Plan water and sanitation networks', 'Manage construction projects', 'Inspect existing infrastructure for safety'],
    ['Consulting engineers', 'Construction companies', 'Municipalities and roads agencies', 'Water utilities'],
    ['Structural engineer', 'Transport and roads engineer', 'Water engineer', 'Geotechnical engineer', 'Project manager'],
    'up-beng-civil',
    { occupations: ['Civil Engineer'] },
  ),
  electrical: engineer(
    'electrical-engineer',
    'Electrical engineer',
    ['electrical engineer', 'electronics', 'power', 'renewable energy', 'solar', 'electricity'],
    'Design the systems that generate, move and use electricity, from power stations to circuit boards.',
    ['Design power, control and electronic systems', 'Plan renewable-energy projects', 'Keep plants and grids running', 'Test and commission equipment'],
    ['Power utilities', 'Renewable-energy companies', 'Mines and factories', 'Telecoms and electronics firms'],
    ['Power systems engineer', 'Renewable-energy engineer', 'Control and instrumentation engineer', 'Electronics engineer'],
    'up-beng-electrical',
    { occupations: ['Electrical Engineer', 'Energy Engineer', 'Electronics Engineer'], manySeekers: true },
  ),
  mechanical: engineer(
    'mechanical-engineer',
    'Mechanical engineer',
    ['mechanical engineer', 'machines', 'cars', 'engines', 'aeronautical', 'aircraft', 'robots'],
    'Design machines and the systems inside them: engines, pumps, vehicles, aircraft and air-conditioning.',
    ['Design and model machines', 'Analyse heat, motion and stress', 'Improve manufacturing processes', 'Lead maintenance in big plants'],
    ['Manufacturers and car makers', 'Mines and power stations', 'Consulting engineers', 'Aerospace and defence'],
    ['Design engineer', 'Maintenance engineer', 'Automotive engineer', 'Aeronautical engineer'],
    'up-beng-mechanical',
    { occupations: ['Mechanical Engineer', 'Aeronautical Engineer'] },
  ),
  chemical: engineer(
    'chemical-engineer',
    'Chemical engineer',
    ['chemical engineer', 'chemical engineering', 'process engineer', 'refinery', 'fuel'],
    'Design the plants that turn raw materials into fuel, metals, medicines, food and clean water.',
    ['Design and optimise processing plants', 'Control reactions safely at large scale', 'Reduce waste and emissions', 'Troubleshoot production'],
    ['Petrochemical and fuel companies', 'Mineral processing plants', 'Food, beverage and pharmaceutical factories', 'Water treatment'],
    ['Process engineer', 'Plant engineer', 'Environmental engineer', 'Production manager'],
    'up-beng-chemical',
    { occupations: ['Chemical Engineer'] },
  ),
  mining: engineer(
    'mining-engineer',
    'Mining engineer',
    ['mining engineer', 'mining', 'mines', 'mine manager'],
    'Plan and run mines so minerals come out of the ground safely and profitably.',
    ['Design mine layouts and blasting plans', 'Plan ventilation and safety systems', 'Schedule production', 'Lead teams underground or in open pits'],
    ['Mining companies', 'Mining consultants', 'Mine equipment suppliers', 'Department of Mineral Resources'],
    ['Mine planning engineer', 'Production engineer', 'Ventilation or rock engineer', 'Mine manager (with a Certificate of Competency)'],
    'up-beng-mining',
    { occupations: ['Mining Engineer'] },
    { interests: ['fixing-building', 'numbers', 'animals-nature'] },
  ),
};

export const CAREERS: Career[] = [
  // ---------------- Health ----------------
  {
    id: 'doctor',
    name: 'Medical doctor',
    aliases: ['doctor', 'dokotela', 'gp', 'general practitioner', 'physician', 'surgeon', 'medicine', 'mbchb', 'paediatrician', 'pediatrician', 'heal sick people', 'hospital'],
    field: 'health',
    oneLine: 'Diagnose illness, treat patients and decide what happens next when someone is sick or injured.',
    whatYouDo: ['Examine patients, order tests and work out what is wrong', 'Prescribe treatment and follow up', 'Work in teams with nurses, pharmacists and specialists', 'Make fast decisions in emergencies'],
    whereYouWork: ['Public hospitals and clinics', 'Private practice', 'Emergency units', 'Research and public health'],
    jobs: ['Medical officer in a hospital', 'General practitioner (GP)', 'Specialist after further training: surgeon, paediatrician, psychiatrist, emergency physician', 'Public health and research'],
    interests: ['helping-people', 'how-things-work'],
    school: {
      needs: [
        MATHS_ESSENTIAL('Every medical school we checked requires Mathematics. Mathematical Literacy is not accepted.'),
        PHYS_ESSENTIAL('Chemistry and physics underpin pharmacology and physiology.'),
        { anyOf: ['life-sciences'], kind: 'recommended', why: 'Not required at UP, but some medical schools ask for it, and it makes first year easier.' },
      ],
    },
    route: [
      { kind: 'study', title: 'MBChB degree', years: 6, detail: 'Theory first, then clinical rotations in hospitals.' },
      { kind: 'practice', title: 'Internship', years: 2, detail: 'Paid training posts in accredited hospitals.' },
      { kind: 'practice', title: 'Community service', years: 1, detail: 'A paid year in a public facility, often outside big cities.' },
      { kind: 'register', title: 'Independent practice', detail: 'Registered with the HPCSA as a medical practitioner.' },
      { kind: 'work', title: 'Specialise (optional)', years: 4, detail: 'Registrar training of about four to five years for a specialty.' },
    ],
    routeSummary: '6 years study, then 3 years internship and community service',
    registration: { body: 'Health Professions Council of South Africa', abbr: 'HPCSA', title: 'Medical practitioner' },
    alternatives: [
      { title: 'Start a BSc and reapply', detail: 'Some universities let strong first-year BSc students apply for medicine again. Rules differ, so ask early.' },
      { title: 'Clinical associate', detail: 'A 3-year degree (Bachelor of Clinical Medical Practice) offered at some universities. You work under doctors in district hospitals.' },
      { title: 'Pharmacist', detail: 'Also a 4-year health degree with strong demand.', careerId: 'pharmacist' },
      { title: 'Professional nurse', detail: 'Hands-on patient care with many specialisations.', careerId: 'nurse' },
    ],
    programmes: ['up-mbchb'],
    funding: ['nsfas'],
    demand: { occupations: ['General Medical Practitioner', 'Emergency Medicine Specialist'] },
  },
  {
    id: 'dentist',
    name: 'Dentist',
    aliases: ['dentist', 'dental', 'teeth', 'orthodontist', 'bds', 'bchd'],
    field: 'health',
    oneLine: 'Keep people’s teeth and mouths healthy, and fix them when they are not.',
    whatYouDo: ['Examine, clean and repair teeth', 'Do extractions, fillings and root canals', 'Take and read X-rays', 'Teach patients how to prevent problems'],
    whereYouWork: ['Private practice', 'Public hospitals and clinics', 'Dental schools'],
    jobs: ['General dentist', 'Specialist after further study: orthodontist, maxillofacial surgeon', 'Public oral health', 'Teaching and research'],
    interests: ['helping-people', 'fixing-building'],
    school: {
      needs: [MATHS_ESSENTIAL('Required at every dental school we checked.'), PHYS_ESSENTIAL('Required at UP.'), { anyOf: ['life-sciences'], kind: 'recommended', why: 'Helps with anatomy and physiology.' }],
    },
    route: [
      { kind: 'study', title: 'Dentistry degree', years: 5, detail: 'Includes treating patients under supervision in later years.' },
      { kind: 'practice', title: 'Community service', years: 1, detail: 'A paid year in a public facility.' },
      { kind: 'register', title: 'Register as a dentist', detail: 'With the HPCSA.' },
    ],
    routeSummary: '5 years study, then 1 year community service',
    registration: { body: 'Health Professions Council of South Africa', abbr: 'HPCSA', title: 'Dentist' },
    alternatives: [
      { title: 'Oral hygiene or dental therapy', detail: 'Shorter degrees that also lead to HPCSA registration and patient work.' },
      { title: 'Medical doctor', detail: 'Very similar school requirements.', careerId: 'doctor' },
    ],
    programmes: ['up-bds'],
    funding: ['nsfas'],
  },
  {
    id: 'pharmacist',
    name: 'Pharmacist',
    aliases: ['pharmacist', 'pharmacy', 'chemist', 'medicines', 'bpharm'],
    field: 'health',
    oneLine: 'The medicines expert: make sure every patient gets the right medicine, at the right dose, safely.',
    whatYouDo: ['Check and dispense prescriptions', 'Advise patients on side effects and how to take medicines', 'Spot dangerous combinations', 'Make or test medicines in industry'],
    whereYouWork: ['Community (retail) pharmacies', 'Hospitals', 'Pharmaceutical companies', 'Regulators and research'],
    jobs: ['Community pharmacist', 'Hospital pharmacist', 'Industrial pharmacist (manufacturing and quality)', 'Regulatory affairs', 'Clinical research'],
    interests: ['helping-people', 'how-things-work'],
    school: {
      needs: [
        MATHS_ESSENTIAL('Required at every pharmacy school we checked.'),
        PHYS_ESSENTIAL('Pharmacy is applied chemistry.'),
        { anyOf: ['life-sciences'], kind: 'essential', why: 'UKZN requires Life Sciences for BPharm.' },
      ],
    },
    route: [
      { kind: 'study', title: 'BPharm degree', years: 4, detail: 'Chemistry, pharmacology and pharmacy practice.' },
      { kind: 'practice', title: 'Internship', years: 1, detail: 'Supervised work in a pharmacy, plus a council exam.' },
      { kind: 'practice', title: 'Community service', years: 1, detail: 'A paid year in a public facility.' },
      { kind: 'register', title: 'Register as a pharmacist', detail: 'With the South African Pharmacy Council.' },
    ],
    routeSummary: '4 years study, then 2 years internship and community service',
    registration: { body: 'South African Pharmacy Council', abbr: 'SAPC', title: 'Pharmacist' },
    alternatives: [
      { title: 'Pharmacist’s assistant', detail: 'A shorter qualification, also registered with the SAPC. You can study further later.' },
      { title: 'BSc in chemistry, biochemistry or pharmacology', detail: 'Leads to laboratory and research work in the medicines industry.' },
    ],
    programmes: ['ukzn-bpharm'],
    funding: ['nsfas'],
    demand: { occupations: ['Hospital Pharmacist', 'Retail Pharmacist'] },
  },
  {
    id: 'physiotherapist',
    name: 'Physiotherapist',
    aliases: ['physio', 'physiotherapist', 'physiotherapy', 'sports injuries', 'rehab', 'rehabilitation'],
    field: 'health',
    oneLine: 'Help people move again after injury, surgery or illness.',
    whatYouDo: ['Assess how a patient moves and where it hurts', 'Plan exercise and hands-on treatment', 'Help patients breathe after surgery or in ICU', 'Work with sports teams on injuries'],
    whereYouWork: ['Hospitals', 'Private practice', 'Sports clubs', 'Rehabilitation centres'],
    jobs: ['Hospital physiotherapist', 'Private practitioner', 'Sports physiotherapist', 'Neuro or paediatric specialist after experience'],
    interests: ['helping-people', 'how-things-work'],
    school: {
      needs: [MATHS_ESSENTIAL('Required at UP.'), PHYS_ESSENTIAL('Required at UP.'), { anyOf: ['life-sciences'], kind: 'recommended', why: 'Some universities require it. It is the basis of anatomy.' }],
    },
    route: [
      { kind: 'study', title: 'Physiotherapy degree', years: 4, detail: 'Anatomy, physiology and supervised clinical practice.' },
      { kind: 'practice', title: 'Community service', years: 1, detail: 'A paid year in a public facility.' },
      { kind: 'register', title: 'Register as a physiotherapist', detail: 'With the HPCSA.' },
    ],
    routeSummary: '4 years study, then 1 year community service',
    registration: { body: 'Health Professions Council of South Africa', abbr: 'HPCSA', title: 'Physiotherapist' },
    alternatives: [
      { title: 'Biokinetics', detail: 'Exercise-based rehabilitation. A sport science degree plus honours, then HPCSA registration.' },
      { title: 'Occupational therapy', detail: 'Helps people do daily tasks again after illness or injury.' },
    ],
    programmes: ['up-physio'],
    funding: ['nsfas'],
    demand: { occupations: ['Physiotherapist'] },
  },
  {
    id: 'radiographer',
    name: 'Diagnostic radiographer',
    aliases: ['radiographer', 'radiography', 'x-ray', 'xray', 'mri', 'ct scan', 'sonographer', 'ultrasound'],
    field: 'health',
    oneLine: 'Take the X-rays and scans that let doctors see inside the body.',
    whatYouDo: ['Position patients and operate X-ray, CT and MRI equipment', 'Keep radiation doses safe', 'Produce clear images for diagnosis', 'Work in trauma units when every minute counts'],
    whereYouWork: ['Hospitals', 'Private radiology practices', 'Mines and occupational health'],
    jobs: ['Diagnostic radiographer', 'CT or MRI radiographer', 'Mammographer', 'Sonographer (after further training)'],
    interests: ['helping-people', 'how-things-work'],
    school: { needs: [MATHS_ESSENTIAL('Required at UP.'), PHYS_ESSENTIAL('Radiation is physics.')] },
    route: [
      { kind: 'study', title: 'Radiography degree', years: 4, detail: 'Physics of imaging, anatomy and supervised clinical work.' },
      { kind: 'practice', title: 'Community service', years: 1, detail: 'A paid year in a public facility.' },
      { kind: 'register', title: 'Register as a radiographer', detail: 'With the HPCSA.' },
    ],
    routeSummary: '4 years study, then 1 year community service',
    registration: { body: 'Health Professions Council of South Africa', abbr: 'HPCSA', title: 'Diagnostic radiographer' },
    alternatives: [{ title: 'Other radiography fields', detail: 'Therapeutic (cancer treatment) and nuclear medicine radiography use similar subjects.' }],
    programmes: ['up-brad'],
    funding: ['nsfas'],
    demand: { occupations: ['Medical Diagnostic Radiographer', 'Sonographer'] },
  },
  {
    id: 'nurse',
    name: 'Professional nurse',
    aliases: ['nurse', 'nursing', 'midwife', 'icu nurse', 'theatre nurse', 'clinic', 'care for patients'],
    field: 'health',
    oneLine: 'The backbone of health care: assess, treat and care for patients around the clock.',
    whatYouDo: ['Monitor patients and act when something changes', 'Give medicines and treatments', 'Deliver babies (as a midwife)', 'Run clinics and lead nursing teams'],
    whereYouWork: ['Hospital wards, ICU and theatre', 'Community clinics', 'Schools, mines and companies'],
    jobs: ['Ward nurse', 'Critical care or theatre nurse', 'Midwife', 'Clinical nurse practitioner (primary care)', 'Nurse educator or manager'],
    interests: ['helping-people'],
    school: {
      needs: [
        { anyOf: ['life-sciences'], kind: 'essential', why: 'Both nursing degrees we checked require Life Sciences.' },
        MATHS_ESSENTIAL('UP requires Mathematics. TUT also accepts Technical Mathematics.'),
        { anyOf: ['physical-sciences'], kind: 'recommended', why: 'TUT requires it. Helps with pharmacology.' },
      ],
    },
    route: [
      { kind: 'study', title: 'Nursing degree', years: 4, detail: 'Theory plus many hours of clinical placement.' },
      { kind: 'practice', title: 'Community service', years: 1, detail: 'A paid year in a public facility.' },
      { kind: 'register', title: 'Register with SANC', detail: 'As a professional nurse (and midwife, depending on the qualification).' },
      { kind: 'work', title: 'Specialise (optional)', years: 1, detail: 'Postgraduate diplomas in critical care, theatre, midwifery and more.' },
    ],
    routeSummary: '4 years study, then 1 year community service',
    registration: { body: 'South African Nursing Council', abbr: 'SANC', title: 'Professional nurse' },
    alternatives: [{ title: 'Nursing colleges', detail: 'Colleges offer shorter nursing qualifications that lead to different nursing categories. Check SANC’s list of accredited programmes.' }],
    programmes: ['up-nursing', 'tut-bnursing'],
    funding: ['nsfas'],
    demand: { occupations: ['Registered Nurse (several specialities)', 'Midwife', 'Clinical Nurse Practitioner'] },
  },
  {
    id: 'vet',
    name: 'Veterinarian',
    aliases: ['vet', 'veterinarian', 'veterinary', 'animal doctor', 'animals', 'bvsc', 'onderstepoort'],
    field: 'health',
    oneLine: 'Doctor for animals: pets, livestock and wildlife, and the food chain that depends on them.',
    whatYouDo: ['Diagnose and treat sick and injured animals', 'Perform surgery', 'Vaccinate herds and control disease outbreaks', 'Inspect food safety'],
    whereYouWork: ['Small-animal clinics', 'Farms and feedlots', 'State veterinary services', 'Wildlife reserves and research'],
    jobs: ['Companion-animal vet', 'Production-animal (farm) vet', 'State veterinarian', 'Wildlife vet', 'Researcher'],
    interests: ['animals-nature', 'helping-people', 'how-things-work'],
    school: {
      needs: [MATHS_ESSENTIAL('Required.'), PHYS_ESSENTIAL('Required.'), { anyOf: ['life-sciences'], kind: 'recommended', why: 'Strongly helps with first-year biology.' }],
      note: 'In South Africa, veterinary science is offered only at the University of Pretoria (Onderstepoort), so places are very limited.',
    },
    route: [
      { kind: 'study', title: 'BVSc degree', years: 6, detail: 'Animal anatomy, disease and lots of practical work.' },
      { kind: 'practice', title: 'Compulsory community service', years: 1, detail: 'A year of service, often in rural areas.' },
      { kind: 'register', title: 'Register as a veterinarian', detail: 'With the South African Veterinary Council.' },
    ],
    routeSummary: '6 years study, then 1 year community service',
    registration: { body: 'South African Veterinary Council', abbr: 'SAVC', title: 'Veterinarian' },
    alternatives: [
      { title: 'Veterinary nursing or animal health', detail: 'Shorter qualifications; these para-veterinary professions also register with the SAVC.' },
      { title: 'Animal or agricultural science', detail: 'Work with livestock, breeding and farm production.' },
    ],
    programmes: ['up-bvsc'],
    funding: ['nsfas'],
    demand: { occupations: ['Veterinarian'] },
  },

  // ---------------- Engineering ----------------
  ...(['civil', 'electrical', 'mechanical', 'chemical', 'mining'] as const).map((kind): Career => ENGINEERS[kind]),
  {
    id: 'civil-technician',
    name: 'Civil engineering technician',
    aliases: ['technician', 'civil technician', 'engineering diploma', 'site technician', 'draughtsman', 'construction'],
    field: 'engineering',
    oneLine: 'Turn engineers’ designs into roads, pipes and buildings on site, and test that they are built right.',
    whatYouDo: ['Set out and supervise work on site', 'Test soil, concrete and materials', 'Draw and check designs with CAD software', 'Inspect municipal works'],
    whereYouWork: ['Construction sites', 'Consulting engineers', 'Municipalities', 'Materials labs'],
    jobs: ['Site technician', 'Design technician', 'Materials lab technician', 'Works inspector', 'Technologist or engineer after further study'],
    interests: ['fixing-building', 'designing'],
    school: { needs: [MATHS_ESSENTIAL('Required for the diploma.'), PHYS_ESSENTIAL('Required for the diploma.'), { anyOf: ['egd', 'civil-tech'], kind: 'recommended', why: 'Drawing and construction knowledge give you a head start.' }] },
    route: [
      { kind: 'study', title: 'Diploma in Civil Engineering', years: 3, detail: 'At a university of technology, including work-integrated learning.' },
      { kind: 'practice', title: 'Candidate technician', years: 3, detail: 'Training at work under a registered professional.' },
      { kind: 'register', title: 'Professional technician', detail: 'With ECSA (Pr Techni Eng).' },
      { kind: 'study', title: 'Study further (optional)', years: 1, detail: 'A BEngTech or advanced diploma can lead to technologist and then engineer.' },
    ],
    routeSummary: '3 years study, then about 3 years of training at work',
    registration: { body: 'Engineering Council of South Africa', abbr: 'ECSA', title: 'Professional engineering technician' },
    alternatives: [{ title: 'Civil engineer', detail: 'The 4-year degree route, with higher entry marks.', careerId: 'civil-engineer' }],
    programmes: ['mut-dip-civil'],
    funding: ['nsfas'],
  },

  // ---------------- Built environment ----------------
  {
    id: 'quantity-surveyor',
    name: 'Quantity surveyor',
    aliases: ['qs', 'quantity surveyor', 'quantity surveying', 'construction costs', 'construction'],
    field: 'built',
    oneLine: 'The money expert on building projects: what it will cost, and whether it stays on budget.',
    whatYouDo: ['Measure drawings and estimate costs', 'Prepare tenders and contracts', 'Track spending on site', 'Value finished work and settle disputes'],
    whereYouWork: ['QS consulting firms', 'Construction companies', 'Property developers', 'Government infrastructure departments'],
    jobs: ['Quantity surveyor', 'Cost estimator', 'Contracts manager', 'Project manager', 'Property developer'],
    interests: ['numbers', 'business', 'fixing-building'],
    school: { needs: [MATHS_ESSENTIAL('Required at UP.'), { anyOf: ['accounting'], kind: 'recommended', why: 'UP’s requirement mentions Accounting, and the work is about money.' }] },
    route: [
      { kind: 'study', title: 'BSc Quantity Surveying', years: 3, detail: 'Construction, measurement, law and economics.' },
      { kind: 'study', title: 'Honours', years: 1, detail: 'Usually needed to register as a professional.' },
      { kind: 'practice', title: 'Candidate quantity surveyor', years: 2, detail: 'Supervised experience.' },
      { kind: 'register', title: 'Professional QS', detail: 'With SACQSP (Pr QS).' },
    ],
    routeSummary: '4 years study, then supervised experience',
    registration: { body: 'South African Council for the Quantity Surveying Profession', abbr: 'SACQSP', title: 'Professional quantity surveyor' },
    alternatives: [{ title: 'Construction management', detail: 'Run building projects on site.' }],
    programmes: ['up-bsc-qs'],
    funding: ['nsfas'],
    demand: { occupations: ['Quantity Surveyor'] },
  },
  {
    id: 'architect',
    name: 'Architect',
    aliases: ['architect', 'architecture', 'design buildings', 'buildings', 'houses'],
    field: 'built',
    oneLine: 'Design buildings and spaces that work for the people who use them.',
    whatYouDo: ['Meet clients and understand what they need', 'Sketch and model designs', 'Produce detailed drawings for builders', 'Get plans approved and check the work on site'],
    whereYouWork: ['Architectural practices', 'Developers', 'Government housing and public works', 'Your own practice'],
    jobs: ['Architect', 'Urban designer', 'Architectural technologist', 'Interior architect', 'Heritage specialist'],
    interests: ['designing', 'fixing-building'],
    school: {
      needs: [MATHS_ESSENTIAL('Required at UP.'), PHYS_ESSENTIAL('Required at UP.'), { anyOf: ['egd', 'visual-arts', 'design'], kind: 'recommended', why: 'Builds the drawing skills selection looks for.' }],
    },
    route: [
      { kind: 'study', title: 'BSc Architecture', years: 3, detail: 'Design studio, history, technology.' },
      { kind: 'study', title: 'Honours and professional master’s', years: 2, detail: 'Usually with practical work in an office in between.' },
      { kind: 'practice', title: 'Candidate architect', years: 2, detail: 'Supervised experience and a professional exam.' },
      { kind: 'register', title: 'Professional architect', detail: 'With SACAP (Pr Arch).' },
    ],
    routeSummary: 'About 5 years study, plus supervised experience',
    registration: { body: 'South African Council for the Architectural Profession', abbr: 'SACAP', title: 'Professional architect' },
    alternatives: [{ title: 'Architectural technologist', detail: 'A university-of-technology route. Also registers with SACAP.' }],
    programmes: ['up-bsc-arch'],
    funding: ['nsfas'],
  },

  // ---------------- Money and risk ----------------
  {
    id: 'chartered-accountant',
    name: 'Chartered accountant',
    aliases: ['ca', 'ca(sa)', 'accountant', 'chartered accountant', 'auditor', 'accounting', 'tax', 'cfo', 'finance'],
    field: 'commerce',
    oneLine: 'Make sure the numbers tell the truth, and help businesses decide what to do with money.',
    whatYouDo: ['Audit companies’ financial statements', 'Advise on tax and investments', 'Lead finance teams', 'Investigate fraud'],
    whereYouWork: ['Audit firms', 'Banks and corporates', 'Government (including the Auditor-General)', 'Your own practice'],
    jobs: ['External auditor', 'Financial manager, then CFO', 'Tax specialist', 'Forensic accountant', 'Investment analyst'],
    interests: ['numbers', 'business'],
    school: {
      needs: [
        MATHS_ESSENTIAL('Required for CA-stream degrees. The Thuthuka bursary does not accept Mathematical Literacy or Technical Mathematics.'),
        { anyOf: ['accounting'], kind: 'recommended', why: 'Not required at UP, but it gives you a real head start.' },
      ],
    },
    route: [
      { kind: 'study', title: 'BCom Accounting (CA stream)', years: 3, detail: 'At a SAICA-accredited university.' },
      { kind: 'study', title: 'Postgraduate year (CTA)', years: 1, detail: 'Then the first SAICA exam.' },
      { kind: 'practice', title: 'Training programme', years: 3, detail: 'Paid training at an approved employer, with the final SAICA exam.' },
      { kind: 'register', title: 'CA(SA)', detail: 'Membership of SAICA.' },
    ],
    routeSummary: '4 years study, then 3 years paid training',
    registration: { body: 'South African Institute of Chartered Accountants', abbr: 'SAICA', title: 'Chartered Accountant (SA)' },
    alternatives: [
      { title: 'Professional accountant (SAIPA) or management accountant (CIMA)', detail: 'Other accounting designations with different exams.' },
      { title: 'Diploma in accounting', detail: 'A university-of-technology route into bookkeeping and accounting jobs.' },
    ],
    programmes: ['up-bcom-acc'],
    funding: ['thuthuka', 'nsfas'],
    demand: { occupations: ['External Auditor', 'Financial Accountant', 'Tax Professional', 'Forensic Accountant'] },
  },
  {
    id: 'actuary',
    name: 'Actuary',
    aliases: ['actuary', 'actuarial', 'actuarial science', 'risk', 'insurance', 'statistics money'],
    field: 'commerce',
    oneLine: 'Use mathematics to put a price on risk: how long people live, how often cars crash, how markets move.',
    whatYouDo: ['Build models of risk and uncertainty', 'Price insurance and medical-scheme cover', 'Make sure pension funds can pay out', 'Advise boards on financial risk'],
    whereYouWork: ['Life and short-term insurers', 'Medical schemes', 'Banks and investment managers', 'Consulting firms'],
    jobs: ['Actuarial analyst, then actuary', 'Risk manager', 'Investment and pension specialist', 'Data scientist'],
    interests: ['numbers', 'business', 'computers'],
    school: { needs: [MATHS_ESSENTIAL('UP asks for Mathematics at level 7 (80%). This is one of the most maths-heavy careers.')] },
    route: [
      { kind: 'study', title: 'Actuarial degree', years: 3, detail: 'Statistics, financial maths and economics. Many do honours too.' },
      { kind: 'exam', title: 'Professional exams while working', years: 4, detail: 'Actuarial Society exams, written over several years.' },
      { kind: 'register', title: 'Fellow actuary', detail: 'Fellow of the Actuarial Society of South Africa.' },
    ],
    routeSummary: '3–4 years study, then exams while you work',
    registration: { body: 'Actuarial Society of South Africa', abbr: 'ASSA', title: 'Fellow (FASSA)' },
    alternatives: [{ title: 'Statistics or data science', detail: 'Similar maths, broader range of employers.', careerId: 'data-scientist' }],
    programmes: ['up-bsc-actuarial'],
    funding: ['nsfas'],
    demand: { occupations: ['Actuary'] },
  },

  // ---------------- Computing and data ----------------
  {
    id: 'software-developer',
    name: 'Software developer',
    aliases: ['programmer', 'coder', 'developer', 'software engineer', 'app developer', 'web developer', 'games', 'coding', 'computers', 'it', 'computer science', 'cyber security'],
    field: 'ict',
    oneLine: 'Build the apps, websites and systems people use every day.',
    whatYouDo: ['Turn a problem into working code', 'Design how systems fit together', 'Test, fix and improve software', 'Work in teams with designers and users'],
    whereYouWork: ['Tech companies and start-ups', 'Banks and insurers', 'Government and mines', 'Remote, for companies anywhere'],
    jobs: ['Software developer', 'Web or mobile developer', 'Systems analyst', 'Security specialist', 'DevOps or cloud engineer'],
    interests: ['computers', 'numbers', 'fixing-building'],
    school: {
      needs: [
        MATHS_ESSENTIAL('Degrees require Mathematics. TUT’s diploma also accepts Technical Mathematics.'),
        { anyOf: ['it'], kind: 'recommended', why: 'IT teaches real programming. CAT is about using software, not writing it.' },
      ],
    },
    route: [
      { kind: 'study', title: 'BSc Computer Science or IT', years: 3, detail: 'Or a 3-year diploma at a university of technology.' },
      { kind: 'work', title: 'Junior developer', years: 2, detail: 'Most learning happens on the job. A portfolio of your own projects helps you get hired.' },
      { kind: 'work', title: 'Developer, then senior or lead', detail: 'No compulsory professional registration.' },
    ],
    routeSummary: '3 years study, then you start working',
    alternatives: [
      { title: 'Diploma in Computer Science', detail: 'A university-of-technology route with lower entry marks.' },
      { title: 'Data scientist', detail: 'For people who love maths as much as code.', careerId: 'data-scientist' },
    ],
    programmes: ['up-bsc-cs', 'up-bsc-it-iks', 'tut-dip-cs'],
    funding: ['nsfas'],
    demand: { occupations: ['Software Developer', 'Web Developer', 'ICT Security Specialist', 'ICT Systems Analyst'] },
  },
  {
    id: 'data-scientist',
    name: 'Data scientist',
    aliases: ['data scientist', 'data science', 'statistician', 'statistics', 'ai', 'machine learning', 'data analyst'],
    field: 'ict',
    oneLine: 'Find patterns in data and turn them into decisions, predictions and AI systems.',
    whatYouDo: ['Clean and explore large data sets', 'Build statistical and machine-learning models', 'Test whether a result is real or chance', 'Explain findings to people who are not statisticians'],
    whereYouWork: ['Banks and insurers', 'Retail and telecoms', 'Health and research', 'Government statistics'],
    jobs: ['Data analyst', 'Data scientist', 'Machine-learning engineer', 'Statistician', 'Risk analyst'],
    interests: ['numbers', 'computers', 'how-things-work'],
    school: { needs: [MATHS_ESSENTIAL('Required at level 6 (70%) at UP. Statistics is mathematics.'), { anyOf: ['it'], kind: 'recommended', why: 'You will write code every day.' }] },
    route: [
      { kind: 'study', title: 'BSc in statistics, mathematics or computer science', years: 3, detail: 'Pick modules in programming and statistics.' },
      { kind: 'study', title: 'Honours (common)', years: 1, detail: 'Many employers prefer it.' },
      { kind: 'work', title: 'Analyst, then data scientist', detail: 'Statisticians can register with SACNASP, but most jobs do not require it.' },
    ],
    routeSummary: '3–4 years study, then you start working',
    alternatives: [
      { title: 'Actuary', detail: 'Similar maths, focused on risk and insurance.', careerId: 'actuary' },
      { title: 'Software developer', detail: 'More building, less statistics.', careerId: 'software-developer' },
    ],
    programmes: ['up-bsc-stats', 'up-bsc-cs'],
    funding: ['nsfas'],
    demand: { occupations: ['Data Scientist', 'Statistician'] },
  },

  // ---------------- Earth and science ----------------
  {
    id: 'geologist',
    name: 'Geologist',
    aliases: ['geologist', 'geology', 'rocks', 'mining geologist', 'groundwater', 'earth science'],
    field: 'science',
    oneLine: 'Read the rocks: find minerals and water, and keep mines and buildings safe.',
    whatYouDo: ['Map rocks in the field', 'Log drill cores and model ore bodies', 'Find and protect groundwater', 'Assess ground stability for building and mining'],
    whereYouWork: ['Mines and exploration companies', 'Council for Geoscience', 'Engineering and environmental consultants', 'Water authorities'],
    jobs: ['Exploration geologist', 'Mine geologist', 'Hydrogeologist', 'Engineering geologist', 'Researcher'],
    interests: ['how-things-work', 'animals-nature'],
    school: { needs: [MATHS_ESSENTIAL('Required at UP.'), PHYS_ESSENTIAL('Required at UP.'), { anyOf: ['geography'], kind: 'recommended', why: 'Introduces landforms and maps.' }] },
    route: [
      { kind: 'study', title: 'BSc Geology', years: 3, detail: 'With field trips and mapping camps.' },
      { kind: 'study', title: 'Honours', years: 1, detail: 'Most geology jobs ask for it.' },
      { kind: 'practice', title: 'Candidate natural scientist', years: 3, detail: 'Supervised experience.' },
      { kind: 'register', title: 'Professional natural scientist', detail: 'With SACNASP (Pr Sci Nat).' },
    ],
    routeSummary: '4 years study, then supervised experience',
    registration: { body: 'South African Council for Natural Scientific Professions', abbr: 'SACNASP', title: 'Professional natural scientist' },
    alternatives: [{ title: 'Mining engineer', detail: 'Plan and run the mine instead of finding the ore.', careerId: 'mining-engineer' }],
    programmes: ['up-bsc-geology'],
    funding: ['nsfas'],
    demand: { occupations: ['Geologist', 'Geophysicist', 'Hydrologist'] },
  },

  // ---------------- Teaching ----------------
  {
    id: 'teacher-stem',
    name: 'Maths or science teacher',
    aliases: ['teacher', 'teaching', 'educator', 'maths teacher', 'science teacher', 'bed', 'lecturer'],
    field: 'education',
    oneLine: 'Teach Grades 7–12 the subjects that open the most doors, and change what learners believe they can do.',
    whatYouDo: ['Plan and teach lessons', 'Set and mark assessments', 'Spot learners who are falling behind and help them catch up', 'Run clubs, olympiads and extra classes'],
    whereYouWork: ['Public and independent schools', 'TVET colleges', 'Tutoring and online education', 'Education departments'],
    jobs: ['FET Mathematics or Physical Sciences teacher', 'Head of department', 'Subject advisor', 'Curriculum or content developer'],
    interests: ['explaining', 'numbers', 'how-things-work'],
    school: {
      needs: [
        MATHS_ESSENTIAL('You cannot teach Mathematics or science subjects without it. UP asks for level 5 (60%) for science teaching subjects.'),
        { anyOf: ['physical-sciences'], kind: 'recommended', why: 'Required at UP if you want to teach Physical or Life Sciences.' },
      ],
    },
    route: [
      { kind: 'study', title: 'BEd (Senior Phase and FET)', years: 4, detail: 'Includes teaching practice in schools every year.' },
      { kind: 'register', title: 'Register with SACE', detail: 'All teachers must be registered with the South African Council for Educators.' },
      { kind: 'work', title: 'Teach', detail: 'With a Funza Lushaka bursary, you teach in a public school one year for each year funded.' },
    ],
    routeSummary: '4 years study, then you start teaching',
    registration: { body: 'South African Council for Educators', abbr: 'SACE', title: 'Educator' },
    alternatives: [{ title: 'Degree first, then PGCE', detail: 'Do a BSc, then a one-year Postgraduate Certificate in Education.' }],
    programmes: ['up-bed-fet-science'],
    funding: ['funza-lushaka', 'nsfas'],
    demand: { occupations: ['FET Phase School Teacher (Grades 10–12)', 'Senior Phase School Teacher (Grades 7–9)'] },
  },

  // ---------------- Law and the mind ----------------
  {
    id: 'lawyer',
    name: 'Lawyer (attorney or advocate)',
    aliases: ['lawyer', 'attorney', 'advocate', 'law', 'llb', 'judge', 'prosecutor', 'magistrate', 'legal'],
    field: 'law-society',
    oneLine: 'Advise people on their rights, draft the agreements that run the economy, and argue cases in court.',
    whatYouDo: ['Research the law and apply it to a client’s problem', 'Draft contracts, wills and court papers', 'Negotiate settlements', 'Argue in court (mostly advocates)'],
    whereYouWork: ['Law firms', 'The Bar (as an advocate)', 'National Prosecuting Authority and Legal Aid', 'Companies’ legal departments'],
    jobs: ['Attorney', 'Advocate', 'Prosecutor', 'Corporate legal adviser', 'Later: magistrate or judge'],
    interests: ['arguing-writing', 'helping-people'],
    school: {
      needs: [{ anyOf: ['english'], kind: 'essential', why: 'UP asks for English at level 6 (70%). Law is reading and writing.' }],
      note: 'At UP, the LLB does not require Mathematics, so Mathematical Literacy keeps this route open.',
    },
    route: [
      { kind: 'study', title: 'LLB degree', years: 4, detail: 'The same degree for attorneys and advocates.' },
      { kind: 'practice', title: 'Practical vocational training', years: 1, detail: 'Attorneys do articles at a firm; advocates do pupillage. Both write Legal Practice Council exams.' },
      { kind: 'register', title: 'Admitted as attorney or advocate', detail: 'Enrolled with the Legal Practice Council.' },
    ],
    routeSummary: '4 years study, then 1–2 years practical training',
    registration: { body: 'Legal Practice Council', abbr: 'LPC', title: 'Attorney or advocate' },
    alternatives: [{ title: 'BA or BCom first, then LLB', detail: 'A shorter postgraduate LLB after another degree.' }],
    programmes: ['up-llb'],
    funding: ['nsfas'],
  },
  {
    id: 'psychologist',
    name: 'Clinical psychologist',
    aliases: ['psychologist', 'psychology', 'therapist', 'counsellor', 'counselor', 'mental health'],
    field: 'law-society',
    oneLine: 'Assess and treat mental health conditions, and help people through the hardest parts of their lives.',
    whatYouDo: ['Assess people using interviews and tests', 'Provide therapy', 'Work in hospital teams with psychiatrists', 'Research how people think and behave'],
    whereYouWork: ['Hospitals and clinics', 'Private practice', 'NGOs and schools', 'Universities'],
    jobs: ['Clinical psychologist', 'Registered counsellor (shorter route)', 'Researcher', 'Lecturer'],
    interests: ['helping-people', 'arguing-writing'],
    school: {
      needs: [{ anyOf: ['english'], kind: 'essential', why: 'UP asks for English at level 5 (60%) for the BA.' }],
      note: 'Mathematics is not required to start at UP, but psychology uses statistics, so Mathematics helps.',
    },
    route: [
      { kind: 'study', title: 'BA or BSocSci with Psychology', years: 3, detail: 'Psychology as a major.' },
      { kind: 'study', title: 'Honours', years: 1, detail: 'Selection is competitive.' },
      { kind: 'study', title: 'Master’s in Clinical Psychology', years: 2, detail: 'Very selective, and includes a 12-month internship.' },
      { kind: 'practice', title: 'Community service', years: 1, detail: 'A paid year in a public facility.' },
      { kind: 'register', title: 'Clinical psychologist', detail: 'With the HPCSA.' },
    ],
    routeSummary: '6 years study, then 1 year community service',
    registration: { body: 'Health Professions Council of South Africa', abbr: 'HPCSA', title: 'Clinical psychologist' },
    alternatives: [
      { title: 'Registered counsellor', detail: 'A shorter route (about 4 years) to HPCSA registration for short-term counselling.' },
      { title: 'Social work', detail: 'Support people and families through hardship.' },
    ],
    programmes: ['up-ba'],
    funding: ['nsfas'],
    demand: { occupations: ['Clinical Psychologist'] },
  },

  // ---------------- Trades ----------------
  {
    id: 'electrician',
    name: 'Electrician',
    aliases: ['electrician', 'sparky', 'wiring', 'electrical', 'solar installer', 'artisan', 'trade', 'tvet'],
    field: 'trades',
    oneLine: 'Install, maintain and fault-find the wiring and machines that run homes, mines and factories.',
    whatYouDo: ['Install and repair wiring, boards and motors', 'Find faults safely under pressure', 'Install solar systems', 'Test installations and issue certificates of compliance (once registered)'],
    whereYouWork: ['Construction', 'Mines and factories', 'Municipalities and utilities', 'Your own contracting business'],
    jobs: ['Construction or maintenance electrician', 'Industrial electrician on a mine or plant', 'Solar installer', 'Electrical contractor (own business)', 'Inspector'],
    interests: ['fixing-building', 'how-things-work'],
    school: {
      needs: [
        { anyOf: ['maths', 'tech-maths'], kind: 'essential', why: 'Artisan programmes need Mathematics, not Mathematical Literacy.' },
        { anyOf: ['physical-sciences', 'tech-sciences', 'electrical-tech'], kind: 'recommended', why: 'Employers advertising apprenticeships often ask for Physical Sciences.' },
      ],
    },
    entry: { text: 'To enter a recognised artisan programme you need at least 40% for Mathematics (not Mathematical Literacy) and a Grade 9 or NC(V) Level 2 pass. Many employers ask for Grade 12 with Mathematics and Physical Sciences.', source: 'vukuzenzele-artisans' },
    route: [
      { kind: 'study', title: 'TVET college: NC(V) or N1–N3', years: 2, detail: 'Electrical theory and workshop practice.' },
      { kind: 'practice', title: 'Apprenticeship', years: 3, detail: 'Paid training with an employer, logging your practical hours.' },
      { kind: 'exam', title: 'Trade test', detail: 'A practical exam moderated nationally. Pass it and you are a qualified artisan.' },
      { kind: 'register', title: 'Registration to sign off work (optional)', detail: 'Register with the Department of Employment and Labour to issue certificates of compliance.' },
    ],
    routeSummary: 'About 3–4 years of college and paid apprenticeship',
    alternatives: [
      { title: 'Electrical engineer', detail: 'The university route, with higher entry marks.', careerId: 'electrical-engineer' },
      { title: 'Fitter and turner or millwright', detail: 'Other high-demand engineering trades.', careerId: 'fitter-turner' },
    ],
    programmes: [],
    funding: ['nsfas'],
    demand: { occupations: ['Electrician', 'Solar Installer', 'Special Class Electrician'], manySeekers: true },
  },
  {
    id: 'fitter-turner',
    name: 'Fitter and turner',
    aliases: ['fitter', 'fitter and turner', 'turner', 'millwright', 'machinist', 'mechanic', 'artisan', 'trade', 'boilermaker', 'welder'],
    field: 'trades',
    oneLine: 'Make, fit and repair the precision parts that keep machines running.',
    whatYouDo: ['Machine parts on lathes and mills', 'Assemble and align pumps, gearboxes and conveyors', 'Read technical drawings', 'Diagnose why a machine has failed'],
    whereYouWork: ['Mines', 'Factories and power stations', 'Engineering workshops', 'Sugar mills, refineries and ports'],
    jobs: ['Fitter and turner', 'Millwright (with electrical training)', 'Maintenance planner', 'Workshop foreman', 'Own engineering workshop'],
    interests: ['fixing-building', 'how-things-work'],
    school: {
      needs: [
        { anyOf: ['maths', 'tech-maths'], kind: 'essential', why: 'Artisan programmes need Mathematics, not Mathematical Literacy.' },
        { anyOf: ['physical-sciences', 'tech-sciences', 'mechanical-tech', 'egd'], kind: 'recommended', why: 'Drawing and science make the theory easier.' },
      ],
    },
    entry: { text: 'To enter a recognised artisan programme you need at least 40% for Mathematics (not Mathematical Literacy) and a Grade 9 or NC(V) Level 2 pass. Many employers ask for Grade 12 with Mathematics and Physical Sciences.', source: 'vukuzenzele-artisans' },
    route: [
      { kind: 'study', title: 'TVET college: NC(V) or N1–N3', years: 2, detail: 'Engineering theory and workshop practice.' },
      { kind: 'practice', title: 'Apprenticeship', years: 3, detail: 'Paid training with an employer.' },
      { kind: 'exam', title: 'Trade test', detail: 'A practical exam moderated nationally.' },
      { kind: 'work', title: 'Qualified artisan', detail: 'Further study (N4–N6) can lead to supervisory and technician roles.' },
    ],
    routeSummary: 'About 3–4 years of college and paid apprenticeship',
    alternatives: [{ title: 'Mechanical engineer', detail: 'Design the machines instead of building them.', careerId: 'mechanical-engineer' }],
    programmes: [],
    funding: ['nsfas'],
    demand: { occupations: ['Fitter and Turner', 'Millwright', 'Mechanical Fitter'], manySeekers: true },
  },
];

export const careerById = (id: string): Career | undefined => CAREERS.find((c) => c.id === id);
