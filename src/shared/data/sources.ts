/**
 * Every fact a learner could act on points at one of these sources.
 * kind: 'primary' = published by the institution or government body itself; 'secondary' = a third party summarising it.
 * Secondary facts are shown with a "check this" marker in the app and listed in docs/DATA.md for verification.
 */

export type SourceId =
  | 'up-prospectus-2027'
  | 'up-mbchb-2027'
  | 'up-civil-2026-yearbook'
  | 'ukzn-bpharm'
  | 'saqa-mut-civil-diploma'
  | 'tut-2027-secondary'
  | 'dbe-subject-choice'
  | 'wced-bachelor-pass'
  | 'dhet-oihd-2024'
  | 'vukuzenzele-artisans'
  | 'nsfas-thresholds'
  | 'funza-lushaka-2027'
  | 'thuthuka-2027'
  | 'uj-dates-2027-secondary'
  | 'up-dates-2027-secondary';

export interface Source {
  id: SourceId;
  title: string;
  publisher: string;
  url: string;
  kind: 'primary' | 'secondary';
  /** When we last read it (ISO date). */
  checked: string;
  note?: string;
}

const CHECKED = '2026-11-06';

export const SOURCES: Record<SourceId, Source> = {
  'up-prospectus-2027': {
    id: 'up-prospectus-2027',
    title: 'Undergraduate prospectus 2027: Applicants with an NSC/IEB Certificate',
    publisher: 'University of Pretoria',
    url: 'https://assets.apply.org.za/u-files/Prospectuses/UP2027.pdf',
    kind: 'primary',
    checked: CHECKED,
    note: "UP's own document, read from the copy hosted by UniApplyForMe. Official programme pages: https://www.up.ac.za/programmes",
  },
  'up-mbchb-2027': {
    id: 'up-mbchb-2027',
    title: 'Bachelor of Medicine and Surgery (MBChB), 2027 admission requirements',
    publisher: 'University of Pretoria',
    url: 'https://www.up.ac.za/programmes/undergraduate/bachelor-of-medicine-and-surgery-mbchb/2027',
    kind: 'primary',
    checked: CHECKED,
  },
  'up-civil-2026-yearbook': {
    id: 'up-civil-2026-yearbook',
    title: 'BEng in Civil Engineering: 4-year and 5-year programme requirements',
    publisher: 'University of Pretoria (Yearbook)',
    url: 'https://www.up.ac.za/yearbooks/2026/EBIT-faculty/UD-programmes/view/12130017',
    kind: 'primary',
    checked: CHECKED,
  },
  'ukzn-bpharm': {
    id: 'ukzn-bpharm',
    title: 'Bachelor of Pharmacy: requirements',
    publisher: 'University of KwaZulu-Natal, College of Health Sciences',
    url: 'https://chs.ukzn.ac.za/undergraduate-progra/bachelor-of-pharmacy/',
    kind: 'primary',
    checked: CHECKED,
  },
  'saqa-mut-civil-diploma': {
    id: 'saqa-mut-civil-diploma',
    title: 'Diploma in Civil Engineering (SAQA ID 96855), minimum admission requirements',
    publisher: 'SAQA (qualification registered by Mangosuthu University of Technology)',
    url: 'https://allqs.saqa.org.za/showQualification.php?id=96855',
    kind: 'primary',
    checked: CHECKED,
  },
  'tut-2027-secondary': {
    id: 'tut-2027-secondary',
    title: 'TUT 2027 requirements, as summarised by VarsityWise',
    publisher: 'VarsityWise (third party)',
    url: 'https://varsitywise.com/posts/mathematical-literacy-vs-mathematics-at-tut-does-it-matter-which-one-you-have',
    kind: 'secondary',
    checked: CHECKED,
    note: 'Check against the TUT 2027 prospectus before relying on it.',
  },
  'dbe-subject-choice': {
    id: 'dbe-subject-choice',
    title: 'Subject choice and career pathing',
    publisher: 'Department of Basic Education',
    url: 'https://www.education.gov.za/Informationfor/Learners/SubjectChoiceandCareerPathing/tabid/980/Default.aspx',
    kind: 'primary',
    checked: CHECKED,
  },
  'wced-bachelor-pass': {
    id: 'wced-bachelor-pass',
    title: "NSC results: Bachelor's pass",
    publisher: 'Western Cape Education Department',
    url: 'https://wcedonline.westerncape.gov.za/documents/NSC-results/Bachlor-Pass.html',
    kind: 'primary',
    checked: CHECKED,
  },
  'dhet-oihd-2024': {
    id: 'dhet-oihd-2024',
    title: 'National List of Occupations in High Demand: 2024 (Government Gazette 50510)',
    publisher: 'Department of Higher Education and Training',
    url: 'https://www.gov.za/sites/default/files/gcis_document/202404/50510gen2414.pdf',
    kind: 'primary',
    checked: CHECKED,
    note: 'DHET says it will publish the next list in 2026.',
  },
  'vukuzenzele-artisans': {
    id: 'vukuzenzele-artisans',
    title: 'SA needs skilled tradesmen',
    publisher: "Vuk'uzenzele (Government Communication and Information System)",
    url: 'https://www.vukuzenzele.gov.za/sa-needs-skilled-tradesmen',
    kind: 'primary',
    checked: CHECKED,
  },
  'nsfas-thresholds': {
    id: 'nsfas-thresholds',
    title: 'NSFAS funding eligibility',
    publisher: 'Rhodes University Registrar (quoting NSFAS rules)',
    url: 'https://www.ru.ac.za/registrar/nsfas',
    kind: 'primary',
    checked: CHECKED,
    note: 'Apply only through https://www.nsfas.org.za',
  },
  'funza-lushaka-2027': {
    id: 'funza-lushaka-2027',
    title: 'Funza Lushaka Bursary 2027: dates and conditions',
    publisher: 'StudentRoom (summarising the DBE notice)',
    url: 'https://www.studentroom.co.za/?p=71572',
    kind: 'secondary',
    checked: CHECKED,
    note: 'Official portal: https://www.funzalushaka.doe.gov.za',
  },
  'thuthuka-2027': {
    id: 'thuthuka-2027',
    title: 'SAICA Thuthuka Bursary 2027: requirements and closing date',
    publisher: 'StudentRoom (summarising SAICA)',
    url: 'https://www.studentroom.co.za/?p=70798',
    kind: 'secondary',
    checked: CHECKED,
    note: 'Official information: SAICA Thuthuka Bursary Fund.',
  },
  'uj-dates-2027-secondary': {
    id: 'uj-dates-2027-secondary',
    title: 'UJ applications for 2027: opening and closing dates',
    publisher: 'Edupstairs (third party)',
    url: 'https://www.edupstairs.org/university-of-johannesburg-uj-applications-for-2027-how-to-apply-courses-aps-nsfas-bursaries-status-check-and-past-exam-papers/',
    kind: 'secondary',
    checked: CHECKED,
  },
  'up-dates-2027-secondary': {
    id: 'up-dates-2027-secondary',
    title: 'UP applications for 2027: opening and closing dates',
    publisher: 'VarsityWise (third party)',
    url: 'https://varsitywise.com/posts/2027-applications-now-open-at-university-of-pretoria',
    kind: 'secondary',
    checked: CHECKED,
  },
};
