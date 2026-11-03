// Non-inclusive wording in identifiers, comments, UI strings and docs.

import type { Finding, Severity } from "./types";
import { normalizeLine, snippetOf } from "./text";

type RawFinding = Omit<Finding, "id" | "source">;

type Term = {
  id: string;
  pattern: RegExp;
  /** Only flag when this also matches the line (cuts false positives). */
  requires?: RegExp;
  /** Skip when this matches (avoids double-reporting the same phrase). */
  excludes?: RegExp;
  severity: Severity;
  title: string;
  why: string;
  instead: string;
};

const TERMS: Term[] = [
  {
    id: "master-slave",
    pattern: /\bslaves?\b/,
    severity: "medium",
    title: '"slave" used as a technical term',
    why: "Master/slave terminology references slavery. Most major projects (Python, Redis, GitHub, MySQL) have replaced it.",
    instead: "primary / replica, leader / follower, controller / worker",
  },
  {
    id: "master",
    pattern: /\bmasters?\b/,
    requires: /\b(node|server|db|database|replica|branch|process|worker|host|instance)\b/,
    excludes: /\bslaves?\b/,
    severity: "low",
    title: '"master" used for a system role',
    why: "When paired with replicas or workers, 'master' carries the master/slave metaphor. Git and GitHub now default to 'main'.",
    instead: "primary, main, leader, controller",
  },
  {
    id: "whitelist-blacklist",
    pattern: /\b(white|black)[\s-]?list(s|ed|ing)?\b/,
    severity: "low",
    title: "Whitelist / blacklist",
    why: "These terms tie 'white' to good and 'black' to bad. Google, Apple, Microsoft and the UK NCSC have switched to neutral names.",
    instead: "allowlist / denylist (or blocklist)",
  },
  {
    id: "blackhat-whitehat",
    pattern: /\b(white|black)[\s-]?hats?\b/,
    severity: "low",
    title: "White hat / black hat",
    why: "Uses colour as a stand-in for good and bad.",
    instead: "ethical / malicious (hacker)",
  },
  {
    id: "sanity-check",
    pattern: /\b(sanity|insanity)[\s-]?(check|test)s?\b/,
    severity: "low",
    title: '"Sanity check"',
    why: "Links mental health to correctness, which can be hurtful to people with mental illness.",
    instead: "quick check, confidence check, smoke test",
  },
  {
    id: "ableist-crazy",
    pattern: /\b(crazy|insane|insanely|lunatic|psycho|schizo|bonkers)\b/,
    severity: "low",
    title: "Mental-health term used as slang",
    why: "Using conditions as a synonym for 'wild' or 'broken' stigmatises people who live with them.",
    instead: "surprising, unexpected, wild, extreme, incorrect",
  },
  {
    id: "ableist-slur",
    pattern: /\b(retard(ed)?|spaz|spastic|tard)\b/,
    severity: "high",
    title: "Ableist slur",
    why: "This word is a slur against disabled people. It shouldn't appear anywhere in a codebase or product.",
    instead: "slow, delayed, throttled, broken (describe what actually happens)",
  },
  {
    id: "ableist-lame-dumb",
    pattern: /\b(lame|dumb|cripple[ds]?|crippling)\b/,
    severity: "low",
    title: "Disability used as an insult",
    why: "'Lame', 'dumb' and 'crippled' come from disabilities and are used here to mean 'bad' or 'broken'.",
    instead: "weak, simple, silent (for 'dumb' terminals), degraded, impaired",
  },
  {
    id: "blind",
    pattern: /\b(blind(ly)? (to|spot|eye)|turn(ed|s)? a blind eye|tone[\s-]deaf)\b/,
    severity: "low",
    title: "Disability used as a metaphor",
    why: "Uses blindness or deafness to mean ignorance.",
    instead: "unaware of, overlooked, gap, insensitive",
  },
  {
    id: "dummy",
    pattern: /\bdumm(y|ies)\b/,
    severity: "low",
    title: '"Dummy"',
    why: "Historically used to mock people who can't speak. Minor, but easy to replace in code.",
    instead: "placeholder, sample, mock, stub",
  },
  {
    id: "grandfathered",
    pattern: /\bgrandfather(ed|ing)?\b/,
    severity: "low",
    title: '"Grandfathered"',
    why: "Comes from 'grandfather clauses' that were written to stop Black Americans from voting.",
    instead: "legacy, exempt, carried over",
  },
  {
    id: "gendered-work",
    pattern: /\b(man[\s-]?hours?|man[\s-]?days?|man[\s-]?power|man[\s-]?months?|mankind|manned|unmanned|chairman|middleman|foreman|salesman|workman|fireman|policeman)\b/,
    severity: "low",
    title: "Gendered word for people or effort",
    why: "Defaults to men when the role or effort applies to anyone.",
    instead: "person-hours, staff, workforce, humanity, crewed, chair, intermediary, salesperson",
  },
  {
    id: "guys",
    pattern: /\b(hey|hi|hello|thanks|thank you|you|all)\s+guys\b|\bguys\s*[,!]/,
    severity: "low",
    title: '"Guys" as a greeting',
    why: "Addresses a mixed group as male. Small, but noticeable in product copy and docs.",
    instead: "everyone, folks, team, all",
  },
  {
    id: "he-for-user",
    pattern: /\b(the|a|an|each|every|our|your)\s+([a-z]+\s+)?(user|developer|customer|admin|administrator|candidate|applicant|engineer|player|reader|student|client|employee|manager|patient|doctor|nurse|programmer)\b[^.!?\n]{0,60}\b(he|his|him|himself|she|her|hers|herself)\b/,
    severity: "low",
    title: "Gendered pronoun for a generic person",
    why: "Docs and UI text that call every user 'he' (or every nurse 'she') reinforce stereotypes about who uses the product.",
    instead: "they / their, or rewrite in second person ('you')",
  },
  {
    id: "native-guru",
    pattern: /\b(spirit animal|pow[\s-]?wow|tribal knowledge|low man on the totem pole|off the reservation)\b/,
    severity: "low",
    title: "Culturally appropriated phrase",
    why: "These phrases borrow from Indigenous cultures and practices.",
    instead: "favourite, meeting, team knowledge, junior, off-track",
  },
  {
    id: "gypped",
    pattern: /\b(gyp|gypped|gipped|jipped|jewed)\b/,
    severity: "medium",
    title: "Ethnic slur used as a verb",
    why: "Derived from slurs against Romani or Jewish people.",
    instead: "cheated, ripped off, short-changed",
  },
  {
    id: "illegal-alien",
    pattern: /\billegal (alien|immigrant)s?\b/,
    severity: "medium",
    title: '"Illegal alien / immigrant"',
    why: "Labels people as illegal. AP style and many governments use neutral terms.",
    instead: "undocumented person / immigrant",
  },
  {
    id: "normal-people",
    pattern: /\b(normal|regular)\s+(people|users|person|humans)\b(?=[^\n]{0,40}\b(disab|blind|deaf|wheelchair|autis|impair))|\b(disab\w*|blind|deaf|autistic)\b[^\n]{0,40}\b(normal|regular)\s+(people|users)\b/,
    severity: "medium",
    title: 'Disabled users contrasted with "normal" users',
    why: "Calling non-disabled users 'normal' frames disabled people as abnormal.",
    instead: "non-disabled users, other users",
  },
];

export function runLanguageRules(content: string): RawFinding[] {
  const out: RawFinding[] = [];
  content.split(/\r?\n/).forEach((line, i) => {
    if (line.length > 2000) return;
    const normalized = normalizeLine(line);
    for (const term of TERMS) {
      const m = normalized.match(term.pattern);
      if (!m) continue;
      if (term.requires && !term.requires.test(normalized)) continue;
      if (term.excludes && term.excludes.test(normalized)) continue;
      out.push({
        ruleId: `language-${term.id}`,
        category: "Inclusive language",
        severity: term.severity,
        title: term.title,
        explanation: term.why,
        suggestion: `Try: ${term.instead}.`,
        line: i + 1,
        snippet: snippetOf(line),
      });
    }
  });
  return out;
}
