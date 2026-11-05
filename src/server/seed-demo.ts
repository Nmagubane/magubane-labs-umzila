/**
 * Demo data for a pilot walkthrough: one teacher, one Grade 9 class, and learners with realistic plans and marks.
 * Run: npm run seed:demo   (uses DATABASE_PATH, default ./data/umzila.db)
 * Logins (password for all: Demo#Route2026):
 *   teacher  ms.dlamini@demo.umzila.test
 *   learner  thando@demo.umzila.test
 */
import { config } from './config.ts';
import { openDb, one } from './db.ts';
import { createUser } from './auth.ts';
import { createClass, joinClass } from './classes.ts';
import { savePlan, saveMarks } from './plans.ts';
import { PRIVACY_VERSION, type PlanBody } from '../shared/api.ts';
import type { Marks } from '../shared/engine/plan.ts';

const PASSWORD = 'Demo#Route2026';
const db = openDb(config.databasePath);

if (one(db, "SELECT 1 FROM users WHERE email = 'ms.dlamini@demo.umzila.test'")) {
  console.log('Demo data is already there. Delete the database file to start again.');
  process.exit(0);
}

const teacher = createUser(db, { email: 'ms.dlamini@demo.umzila.test', password: PASSWORD, displayName: 'Ms Dlamini', role: 'teacher', school: 'Sizwe Secondary School', consentVersion: PRIVACY_VERSION, verified: true });
const cls = createClass(db, teacher.id, '9B Life Orientation', 9);

interface Demo {
  name: string;
  email: string;
  plan: PlanBody;
  marks?: Marks;
}

const learners: Demo[] = [
  { name: 'Thando', email: 'thando@demo.umzila.test', plan: { grade: 9, englishIs: 'additional', maths: 'maths', electives: ['physical-sciences', 'geography', 'egd'], careers: ['civil-engineer', 'civil-technician'] }, marks: { english: 64, 'other-language': 71, maths: 58, 'life-orientation': 80, 'physical-sciences': 61, geography: 66, egd: 70 } },
  { name: 'Lerato', email: 'lerato@demo.umzila.test', plan: { grade: 9, englishIs: 'additional', maths: 'maths-lit', electives: ['life-sciences', 'geography', 'tourism'], careers: ['doctor', 'nurse'] }, marks: { english: 62, 'other-language': 74, 'maths-lit': 71, 'life-orientation': 82, 'life-sciences': 68, geography: 60, tourism: 75 } },
  { name: 'Sipho', email: 'sipho@demo.umzila.test', plan: { grade: 9, englishIs: 'additional', maths: 'maths', electives: ['physical-sciences', 'life-sciences', 'geography'], careers: ['doctor', 'pharmacist', 'physiotherapist'] }, marks: { english: 72, 'other-language': 78, maths: 81, 'life-orientation': 85, 'physical-sciences': 76, 'life-sciences': 79, geography: 70 } },
  { name: 'Ayanda', email: 'ayanda@demo.umzila.test', plan: { grade: 9, englishIs: 'additional', maths: 'maths-lit', electives: ['accounting', 'business-studies', 'cat'], careers: ['chartered-accountant'] }, marks: { english: 58, 'other-language': 66, 'maths-lit': 74, 'life-orientation': 77, accounting: 69, 'business-studies': 65, cat: 72 } },
  { name: 'Naledi', email: 'naledi@demo.umzila.test', plan: { grade: 9, englishIs: 'home', maths: 'maths', electives: ['it', 'physical-sciences', 'accounting'], careers: ['software-developer', 'data-scientist'] }, marks: { english: 74, 'other-language': 63, maths: 73, 'life-orientation': 80, it: 84, 'physical-sciences': 66, accounting: 70 } },
  { name: 'Kabelo', email: 'kabelo@demo.umzila.test', plan: { grade: 9, englishIs: 'additional', maths: 'maths', electives: ['physical-sciences', 'electrical-tech', 'egd'], careers: ['electrician', 'electrical-engineer'] }, marks: { english: 55, 'other-language': 68, maths: 52, 'life-orientation': 75, 'physical-sciences': 49, 'electrical-tech': 71, egd: 64 } },
  { name: 'Zanele', email: 'zanele@demo.umzila.test', plan: { grade: 9, englishIs: 'home', maths: 'maths-lit', electives: ['history', 'geography', 'dramatic-arts'], careers: ['lawyer'] }, marks: { english: 77, 'other-language': 70, 'maths-lit': 66, 'life-orientation': 81, history: 79, geography: 68, 'dramatic-arts': 85 } },
  { name: 'Musa', email: 'musa@demo.umzila.test', plan: { grade: 9, englishIs: 'additional', maths: 'maths', electives: ['life-sciences', 'agricultural-sciences', 'geography'], careers: ['vet'] }, marks: { english: 61, 'other-language': 72, maths: 63, 'life-orientation': 78, 'life-sciences': 74, 'agricultural-sciences': 76, geography: 64 } },
  { name: 'Palesa', email: 'palesa@demo.umzila.test', plan: { grade: 9, englishIs: 'additional', maths: 'maths', electives: ['physical-sciences', 'life-sciences', 'accounting'], careers: ['teacher-stem', 'actuary'] } },
  { name: 'Bongani', email: 'bongani@demo.umzila.test', plan: { grade: 9, englishIs: 'additional', maths: 'maths', electives: [], careers: [] } },
];

for (const l of learners) {
  const u = createUser(db, { email: l.email, password: PASSWORD, displayName: l.name, role: 'learner', isMinor: true, consentVersion: PRIVACY_VERSION, verified: true });
  joinClass(db, u, cls.code);
  const plan = savePlan(db, u.id, l.plan);
  if (l.marks) saveMarks(db, u.id, 9, 3, l.marks, plan);
}

console.log(`Demo data created in ${config.databasePath}`);
console.log(`  Teacher: ms.dlamini@demo.umzila.test  Learner: thando@demo.umzila.test  Password: ${PASSWORD}`);
console.log(`  Class code: ${cls.code}`);
