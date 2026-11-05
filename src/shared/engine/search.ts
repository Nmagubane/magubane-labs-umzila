/**
 * "What do you want to become?" Learners type anything: "doctor", "dokotela", "I like computers", "build bridges",
 * "enjineer". Search matches names, aliases and plain-language phrases, and tolerates small typos.
 */
import { CAREERS, FIELDS, type Career, type InterestId } from '../data/careers.ts';

export interface SearchHit {
  career: Career;
  score: number;
  /** Why it matched, for the result list ("matches 'bridges'"). */
  matched: string;
}

const STOP = new Set(['i', 'want', 'to', 'be', 'become', 'a', 'an', 'the', 'like', 'love', 'work', 'with', 'in', 'and', 'or', 'of', 'do', 'my', 'me', 'something', 'job', 'career', 'study', 'when', 'grow', 'up', 'am', 'good', 'at']);

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9()+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normalise(s)
    .split(' ')
    .filter((t) => t && !STOP.has(t));
}

/** Levenshtein distance, capped: we only care about 0, 1 or 2. */
export function distance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) >= cap) return cap;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin >= cap) return cap;
    prev = cur;
  }
  return Math.min(prev[b.length]!, cap);
}

const tolerance = (word: string) => (word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0);

function wordMatches(q: string, w: string): number {
  if (q === w) return 1;
  if (w.startsWith(q) && q.length >= 3) return 0.8;
  if (q.length >= 4 && distance(q, w) <= tolerance(w)) return 0.7;
  return 0;
}

export function searchCareers(query: string, careers: Career[] = CAREERS): SearchHit[] {
  const q = normalise(query);
  if (!q) return [];
  const qTokens = tokens(query);
  const hits: SearchHit[] = [];
  for (const career of careers) {
    const phrases = [career.name, ...career.aliases, FIELDS[career.field].name];
    let best = 0;
    let matched = '';
    for (const phrase of phrases) {
      const p = normalise(phrase);
      let score = 0;
      if (p === q) score = 10;
      else if (p.startsWith(q) && q.length >= 2) score = 7;
      else if (q.includes(p) && p.length >= 3) score = 6;
      else {
        const pTokens = p.split(' ');
        const per = qTokens.map((t) => Math.max(0, ...pTokens.map((w) => wordMatches(t, w))));
        const hit = per.filter((x) => x > 0);
        if (hit.length) score = (hit.reduce((a, b) => a + b, 0) / Math.max(qTokens.length, pTokens.length)) * 5;
      }
      // The career's own name outranks an alias with the same score.
      if (phrase === career.name) score += 0.5;
      if (score > best) {
        best = score;
        matched = phrase;
      }
    }
    if (best >= 1.5) hits.push({ career, score: best, matched });
  }
  return hits.sort((a, b) => b.score - a.score || a.career.name.localeCompare(b.career.name));
}

/** "Not sure yet": rank careers by how many chosen interests they share. */
export function careersForInterests(chosen: InterestId[], careers: Career[] = CAREERS): { career: Career; shared: InterestId[] }[] {
  if (!chosen.length) return [];
  return careers
    .map((career) => ({ career, shared: career.interests.filter((i) => chosen.includes(i)) }))
    .filter((r) => r.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || a.career.interests.length - b.career.interests.length || a.career.name.localeCompare(b.career.name));
}
