/**
 * Funding that a learner can plan for from Grade 9. Only schemes with a stable, official home are listed.
 * Dates move every year: `lastCycle` says what happened last time, so a learner knows roughly when to look.
 */
import type { SourceId } from './sources.ts';
import type { FundingId } from './careers.ts';

export interface Funding {
  id: FundingId;
  name: string;
  who: string;
  covers: string;
  conditions: string[];
  lastCycle: string;
  apply: string;
  source: SourceId;
}

export const FUNDING: Record<FundingId, Funding> = {
  nsfas: {
    id: 'nsfas',
    name: 'NSFAS bursary',
    who: 'South African students at public universities and TVET colleges from households earning up to R350 000 a year (R600 000 for students with disabilities).',
    covers: 'Tuition and allowances, for students who qualify.',
    conditions: ['Household income is verified.', 'You must also be accepted by the institution: funding and admission are separate.', 'A separate loan scheme exists for households earning between R350 000 and R600 000.'],
    lastCycle: 'For the 2027 academic year, applications opened in September 2026.',
    apply: 'https://www.nsfas.org.za',
    source: 'nsfas-thresholds',
  },
  'funza-lushaka': {
    id: 'funza-lushaka',
    name: 'Funza Lushaka teaching bursary',
    who: 'Students who will study teaching in a priority subject area. Mathematics and the sciences are among them.',
    covers: 'Study costs for an approved teaching qualification.',
    conditions: ['You teach in a public school for one year for each year you were funded.', 'Your qualification must include the required priority subjects.'],
    lastCycle: 'For 2027, applications opened on 1 October 2026 and close for new applicants on 31 January 2027.',
    apply: 'https://www.funzalushaka.doe.gov.za',
    source: 'funza-lushaka-2027',
  },
  thuthuka: {
    id: 'thuthuka',
    name: 'SAICA Thuthuka bursary',
    who: 'Learners aiming to become chartered accountants at a SAICA-accredited university. SAICA sets citizenship, household-income (R350 000) and population-group criteria: check them with SAICA.',
    covers: 'Study costs plus academic and mentoring support.',
    conditions: ['At least 60% for Mathematics in Grade 11. Mathematical Literacy and Technical Mathematics are not accepted.', 'You write the National Benchmark Tests.'],
    lastCycle: 'For 2027, applications closed on 31 August 2026, during Grade 12. Your Grade 11 marks are what count.',
    apply: 'https://www.saica.org.za',
    source: 'thuthuka-2027',
  },
};
