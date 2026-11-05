/**
 * NSC subjects, Grades 10–12 (CAPS). Every learner takes seven:
 * four compulsory (Home Language, First Additional Language, Mathematics or Mathematical Literacy, Life Orientation)
 * and three electives chosen at the end of Grade 9 (DBE, see sources.ts 'dbe-subject-choice').
 *
 * English is modelled separately from "the other language" because almost every university requirement is written as
 * "English Home Language or English First Additional Language", and the NSC pass rules need to know which is the Home Language.
 */

export type MathsId = 'maths' | 'maths-lit' | 'tech-maths';

export type ElectiveId =
  | 'physical-sciences'
  | 'life-sciences'
  | 'tech-sciences'
  | 'accounting'
  | 'business-studies'
  | 'economics'
  | 'geography'
  | 'history'
  | 'it'
  | 'cat'
  | 'egd'
  | 'agricultural-sciences'
  | 'consumer-studies'
  | 'tourism'
  | 'hospitality'
  | 'visual-arts'
  | 'dramatic-arts'
  | 'music'
  | 'design'
  | 'religion-studies'
  | 'civil-tech'
  | 'electrical-tech'
  | 'mechanical-tech';

export type SubjectId = 'english' | 'other-language' | 'life-orientation' | MathsId | ElectiveId;

export interface SubjectInfo {
  id: SubjectId;
  name: string;
  short: string;
  group: 'language' | 'maths' | 'compulsory' | 'science' | 'commerce' | 'humanities' | 'technology' | 'arts' | 'services';
}

const s = (id: SubjectId, name: string, short: string, group: SubjectInfo['group']): SubjectInfo => ({ id, name, short, group });

export const SUBJECTS: Record<SubjectId, SubjectInfo> = {
  english: s('english', 'English', 'English', 'language'),
  'other-language': s('other-language', 'Second language', '2nd language', 'language'),
  'life-orientation': s('life-orientation', 'Life Orientation', 'LO', 'compulsory'),
  maths: s('maths', 'Mathematics', 'Maths', 'maths'),
  'maths-lit': s('maths-lit', 'Mathematical Literacy', 'Maths Lit', 'maths'),
  'tech-maths': s('tech-maths', 'Technical Mathematics', 'Tech Maths', 'maths'),
  'physical-sciences': s('physical-sciences', 'Physical Sciences', 'Physical Sci', 'science'),
  'life-sciences': s('life-sciences', 'Life Sciences', 'Life Sci', 'science'),
  'tech-sciences': s('tech-sciences', 'Technical Sciences', 'Tech Sci', 'science'),
  'agricultural-sciences': s('agricultural-sciences', 'Agricultural Sciences', 'Agric Sci', 'science'),
  accounting: s('accounting', 'Accounting', 'Accounting', 'commerce'),
  'business-studies': s('business-studies', 'Business Studies', 'Business', 'commerce'),
  economics: s('economics', 'Economics', 'Economics', 'commerce'),
  geography: s('geography', 'Geography', 'Geography', 'humanities'),
  history: s('history', 'History', 'History', 'humanities'),
  'religion-studies': s('religion-studies', 'Religion Studies', 'Religion', 'humanities'),
  it: s('it', 'Information Technology', 'IT', 'technology'),
  cat: s('cat', 'Computer Applications Technology', 'CAT', 'technology'),
  egd: s('egd', 'Engineering Graphics and Design', 'EGD', 'technology'),
  'civil-tech': s('civil-tech', 'Civil Technology', 'Civil Tech', 'technology'),
  'electrical-tech': s('electrical-tech', 'Electrical Technology', 'Electrical Tech', 'technology'),
  'mechanical-tech': s('mechanical-tech', 'Mechanical Technology', 'Mechanical Tech', 'technology'),
  'visual-arts': s('visual-arts', 'Visual Arts', 'Visual Arts', 'arts'),
  'dramatic-arts': s('dramatic-arts', 'Dramatic Arts', 'Drama', 'arts'),
  music: s('music', 'Music', 'Music', 'arts'),
  design: s('design', 'Design', 'Design', 'arts'),
  'consumer-studies': s('consumer-studies', 'Consumer Studies', 'Consumer', 'services'),
  tourism: s('tourism', 'Tourism', 'Tourism', 'services'),
  hospitality: s('hospitality', 'Hospitality Studies', 'Hospitality', 'services'),
};

export const MATHS_OPTIONS: MathsId[] = ['maths', 'maths-lit', 'tech-maths'];

export const ELECTIVES: ElectiveId[] = [
  'physical-sciences',
  'life-sciences',
  'accounting',
  'business-studies',
  'economics',
  'geography',
  'history',
  'it',
  'cat',
  'egd',
  'agricultural-sciences',
  'consumer-studies',
  'tourism',
  'hospitality',
  'visual-arts',
  'dramatic-arts',
  'music',
  'design',
  'religion-studies',
  'tech-sciences',
  'civil-tech',
  'electrical-tech',
  'mechanical-tech',
];

export const isMaths = (id: string): id is MathsId => (MATHS_OPTIONS as string[]).includes(id);
export const isElective = (id: string): id is ElectiveId => (ELECTIVES as string[]).includes(id);
export const subjectName = (id: SubjectId): string => SUBJECTS[id].name;

/** NSC achievement levels (DBE scale). 7 = 80–100%, …, 1 = 0–29%. */
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const LEVEL_FLOOR: Record<Level, number> = { 1: 0, 2: 30, 3: 40, 4: 50, 5: 60, 6: 70, 7: 80 };

export function levelOf(percent: number): Level {
  if (percent >= 80) return 7;
  if (percent >= 70) return 6;
  if (percent >= 60) return 5;
  if (percent >= 50) return 4;
  if (percent >= 40) return 3;
  if (percent >= 30) return 2;
  return 1;
}

/** "Level 5 (60%)" — the way a prospectus says it, and the way a learner understands it. */
export const levelLabel = (l: Level): string => `Level ${l} (${LEVEL_FLOOR[l]}%+)`;
