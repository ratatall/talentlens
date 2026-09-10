import type { Match, Profile, SearchInput, Criteria } from './types';
import { profiles, skillCatalog } from './profiles';
export const tokens = (text: string) => text.toLowerCase().match(/[a-z0-9]+(?:[.+#][a-z0-9]+)*/g) ?? [];
const stop = new Set('a an the with and or for in of to find looking engineer engineers experience experienced years year at least who have has using'.split(' '));
export const queryTokens = (text: string) => [...new Set(tokens(text).filter(t => !stop.has(t)))];
export const profileText = (p: Profile) => `${p.title}. ${p.skills.join(', ')}. ${p.summary} ${p.experience.join(' ')}`;
export function containsSkill(text: string, skill: string) {
  const hay = ` ${tokens(text).join(' ')} `;
  return hay.includes(` ${tokens(skill).join(' ')} `);
}
export function interpretLocally(query: string): Criteria {
  const requiredSkills = skillCatalog.filter(skill => containsSkill(query, skill));
  const years = query.match(/(?:at least\s*)?(\d+)\+?\s*years?/i);
  return { requiredSkills, minYears: Math.min(50, Number(years?.[1] ?? 0)), summary: 'Recognized explicit skills and years only. Review the criteria before searching; complex constraints need the LLM integration.' };
}
export function passesFilters(p: Profile, input: SearchInput) {
  return p.years >= input.minYears && !input.excludedIds.includes(p.id) && input.requiredSkills.every(s => p.skills.some(ps => ps.toLowerCase() === s.toLowerCase()));
}
export function explain(p: Profile, input: SearchInput, score: number): Match {
  const criteria = [...new Set([...input.requiredSkills, ...input.prioritySkills, ...skillCatalog.filter(s => containsSkill(input.query, s))])];
  const evidence: Match['evidence'] = [];
  const missing: string[] = [];
  for (const skill of criteria) {
    const index = p.experience.findIndex(text => containsSkill(text, skill));
    if (index >= 0) evidence.push({ skill, excerpt: p.experience[index], source: `${p.source} · Experience ${index + 1}` });
    else if (p.skills.some(s => s.toLowerCase() === skill.toLowerCase())) evidence.push({ skill, excerpt: p.skills.join(', '), source: `${p.source} · Skills` });
    else missing.push(skill);
  }
  return { profile: p, score, evidence, missing };
}
export function demoSearch(input: SearchInput) {
  const terms = queryTokens(input.query);
  return profiles.filter(p => passesFilters(p, input)).map(p => {
    const text = queryTokens(profileText(p));
    const overlap = terms.reduce((sum, t) => sum + (text.includes(t) ? 1 : 0), 0);
    const priority = input.prioritySkills.filter(s => p.skills.includes(s)).length;
    return { p, overlap, score: overlap + priority * 2 };
  }).filter(p => p.overlap > 0).sort((a,b) => b.score - a.score || a.p.id.localeCompare(b.p.id)).map(p => explain(p.p, input, p.score));
}
export function reciprocalRankFusion(lists: { id: string; score: number }[][]) {
  const scores = new Map<string, number>();
  for (const list of lists) list.forEach((p, i) => scores.set(p.id, (scores.get(p.id) ?? 0) + 1 / (60 + i + 1)));
  return [...scores].map(([id, score]) => ({ id, score })).sort((a,b) => b.score - a.score || a.id.localeCompare(b.id));
}
