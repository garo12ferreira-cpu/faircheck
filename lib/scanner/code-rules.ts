// Rule-based checks for bias risks in source code.
// Each rule looks at one line (sometimes with a few lines of context) and
// explains why the pattern can treat people unfairly and how to fix it.

import type { Finding } from "./types";
import { isCommentLine, lineWords, normalizeLine, snippetOf } from "./text";

type RawFinding = Omit<Finding, "id" | "source">;

/** Words that name a protected characteristic (or something that directly encodes one). */
const PROTECTED: Record<string, string> = {
  gender: "gender", sex: "sex", female: "gender", male: "gender", women: "gender", woman: "gender",
  race: "race", racial: "race", ethnicity: "ethnicity", ethnic: "ethnicity",
  religion: "religion", religious: "religion", nationality: "nationality", citizenship: "citizenship",
  disability: "disability", disabled: "disability", handicap: "disability",
  pregnant: "pregnancy", pregnancy: "pregnancy", marital: "marital status",
  orientation: "sexual orientation", lgbt: "sexual orientation", lgbtq: "sexual orientation",
  age: "age", dob: "age", birthdate: "age", birthday: "age", veteran: "veteran status",
};

/** Data that is not protected itself but is known to stand in for a protected trait. */
const PROXIES: Record<string, string> = {
  zip: "ZIP code (a well-known proxy for race and income, the basis of redlining)",
  zipcode: "ZIP code (a well-known proxy for race and income, the basis of redlining)",
  postcode: "postcode (often a proxy for race and income)",
  postal: "postal code (often a proxy for race and income)",
  neighborhood: "neighbourhood (often a proxy for race and income)",
  neighbourhood: "neighbourhood (often a proxy for race and income)",
  graduation: "graduation year (a proxy for age)",
  accent: "accent (a proxy for national origin)",
  surname: "surname (can act as a proxy for ethnicity)",
};

const DECISION_CONTEXT =
  /\b(hire|hired|hiring|candidate|applicant|application|loan|credit|approve|approved|approval|reject|rejected|deny|denied|eligib\w*|score|scoring|rank|ranking|interview|salary|premium|price|pricing|admit|admission|risk|shortlist|promot\w*|bonus|limit|qualif\w*|accept\w*|filter)\b/i;

const CONDITION_CONTEXT = /(\bif\b|\belif\b|\bwhile\b|\bcase\b|\bwhen\b|\bwhere\b|\?|&&|\|\||\.filter\(|\.where\(|\bfilter\(|\bquery\(|\bmatch\b)/i;

const COMPARISON = /(===?|!==?|<=?|>=?|\bin\b|\bis\b|\bnot in\b|\.includes\(|\.eq\(|\.isin\(|\.equals\()/;

/** "maxAge" on a cookie or cache is not about a person's age. */
const NON_PERSON_AGE = /\b(cookie|cache|ttl|header|session|token|stale|expires?|http|max-age|cdn|etag)\b/i;

function protectedWordsIn(line: string): string[] {
  const words = lineWords(line);
  const hits = new Set<string>();
  for (const w of words) {
    if (!(w in PROTECTED)) continue;
    if (w === "race" && /race\s*condition/i.test(normalizeLine(line))) continue;
    if (w === "age" && NON_PERSON_AGE.test(line)) continue;
    if (w === "sex" && /\bsext/i.test(line)) continue;
    hits.add(PROTECTED[w]);
  }
  return [...hits];
}

function proxyWordsIn(line: string): string[] {
  const words = lineWords(line);
  const hits: string[] = [];
  for (const w of words) {
    if (!(w in PROXIES)) continue;
    if (w === "graduation" && !words.has("year") && !words.has("date")) continue;
    hits.push(PROXIES[w]);
  }
  return [...new Set(hits)];
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// ── Individual rules ──────────────────────────────────────────────────────

function protectedAttributeInLogic(line: string): RawFinding | null {
  if (isCommentLine(line)) return null;
  if (!CONDITION_CONTEXT.test(line) || !COMPARISON.test(line)) return null;
  const traits = protectedWordsIn(line);
  if (traits.length === 0) return null;
  const decision = DECISION_CONTEXT.test(line);
  return {
    ruleId: "protected-attribute-in-logic",
    category: "Protected attribute in logic",
    severity: decision ? "high" : "medium",
    title: `Decision branches on ${list(traits)}`,
    explanation: decision
      ? `This line changes an outcome for a person based on ${list(traits)}. Treating people differently on a protected characteristic in hiring, lending, pricing or similar decisions is direct discrimination and is illegal in many places (e.g. US Title VII and ECOA, UK Equality Act, EU AI Act for high-risk systems).`
      : `This condition branches on ${list(traits)}. If it affects what a person can see, get or pay, it may treat groups differently. Check that the branch is genuinely needed, e.g. for medical dosing or accessibility, and not a shortcut.`,
    suggestion: `Base the decision on the job-relevant or risk-relevant factor itself (skills, verified income, payment history) instead of ${list(traits)}. If the attribute is needed only for auditing, store it separately and keep it out of decision code.`,
  };
}

function proxyInLogic(line: string): RawFinding | null {
  if (isCommentLine(line)) return null;
  if (!CONDITION_CONTEXT.test(line) || !COMPARISON.test(line)) return null;
  const proxies = proxyWordsIn(line);
  if (proxies.length === 0) return null;
  return {
    ruleId: "proxy-in-logic",
    category: "Proxy variable",
    severity: DECISION_CONTEXT.test(line) ? "high" : "medium",
    title: "Decision uses a proxy for a protected trait",
    explanation: `This condition uses ${list(proxies)}. Even without naming a protected trait, proxies like this can produce the same discriminatory outcome, and regulators treat that as disparate impact.`,
    suggestion:
      "Remove the proxy from the decision, or show with data that it is necessary and that a less discriminatory alternative does not exist. Measure outcome rates per group before shipping.",
  };
}

const ML_CONTEXT = /(feature|features|predictors|inputs|\bX\s*=|\.fit\(|train|columns\s*=|feature_cols|select\(|\[\[)/i;

function protectedFeatureInModel(line: string): RawFinding | null {
  if (isCommentLine(line)) return null;
  if (!ML_CONTEXT.test(line)) return null;
  if (/\.drop\(|exclude|remove|del\s|without/i.test(line)) return null;
  const quoted = line.match(/(['"])([A-Za-z_][\w ]*)\1/g) ?? [];
  const traits = new Set<string>();
  const proxies = new Set<string>();
  for (const q of quoted) {
    for (const t of protectedWordsIn(q.slice(1, -1))) traits.add(t);
    for (const t of proxyWordsIn(q.slice(1, -1))) proxies.add(t);
  }
  if (traits.size === 0 && proxies.size === 0) return null;
  if (traits.size === 0) {
    return {
      ruleId: "proxy-feature-in-model",
      category: "Proxy variable",
      severity: "medium",
      title: "Model is trained on a proxy for a protected trait",
      explanation: `The feature list includes ${list([...proxies])}. The model can use it to reproduce discrimination even though no protected column is listed.`,
      suggestion:
        "Drop or coarsen the proxy (e.g. region instead of postal code), and measure per-group outcomes after training to confirm it isn't creating a gap.",
    };
  }
  const proxyNote = proxies.size > 0 ? ` It also includes ${list([...proxies])}.` : "";
  return {
    ruleId: "protected-feature-in-model",
    category: "ML training features",
    severity: "high",
    title: `Model is trained on ${list([...traits])}`,
    explanation: `A protected characteristic (${list([...traits])}) is listed as a model input. The model can learn to score people differently because of it, the same failure that sank Amazon's 2018 recruiting model.${proxyNote}`,
    suggestion:
      "Drop protected columns (and proxies) from the feature set (e.g. X = df.drop(columns=[...])). Keep them in a separate table so you can still measure per-group outcomes after training.",
  };
}

function genderAsBoolean(line: string): RawFinding | null {
  if (!/\b(is|has)_?(male|female|man|woman)\b/i.test(line) && !/\b(is|has)(Male|Female|Man|Woman)\b/.test(line)) return null;
  return {
    ruleId: "gender-boolean",
    category: "Gender assumptions",
    severity: "medium",
    title: "Gender stored as a true/false flag",
    explanation:
      "A boolean like isMale forces every person into one of two options and silently mislabels non-binary people and anyone who prefers not to say.",
    suggestion:
      "Use an optional field with an open set of values, e.g. gender: 'woman' | 'man' | 'non-binary' | 'self-describe' | 'prefer-not-to-say' | null, and only collect it if you truly need it.",
  };
}

const OTHER_GENDER_OPTIONS = /(other|non.?binary|nonbinary|unspecified|prefer|self.?describe|diverse|unknown|not.?say|\bx\b|undisclosed|n\/a)/i;

function binaryGenderOptions(lines: string[], i: number): RawFinding | null {
  const line = lines[i];
  const single = /\b(male|man|m)\b/i.test(line) && /\b(female|woman|f)\b/i.test(line) && /\b(fe)?male\b|\b(wo)?man\b/i.test(line);
  const isOptionsList = /(['"`])\s*(fe)?male\s*\1|\b(FE)?MALE\b\s*[,=]|<option|value=|choices|options|enum|\||gender|\bsex\b|\(\s*\)|\[\s*\]/i.test(line);
  let block = "";
  if (single && isOptionsList) {
    block = line;
  } else if (/gender|sex/i.test(line) && /(enum|choices|options|type\s+\w*|=\s*[\[{(]|:\s*\[|select)/i.test(line)) {
    block = lines.slice(i, i + 8).join("\n");
    if (!(/\b(fe)?male\b|\b(wo)?man\b/i.test(block) && /\bfemale\b|\bwoman\b/i.test(block) && /\bmale\b|\bman\b/i.test(block))) return null;
  } else {
    return null;
  }
  if (OTHER_GENDER_OPTIONS.test(block)) return null;
  return {
    ruleId: "binary-gender-options",
    category: "Gender assumptions",
    severity: "medium",
    title: "Gender options only allow male or female",
    explanation:
      "Offering only two choices excludes non-binary and intersex people, and forces anyone who'd rather not say to give an answer. It also makes the data you collect inaccurate.",
    suggestion:
      "Add 'Non-binary', 'Prefer to self-describe' (free text) and 'Prefer not to say', and make the field optional. Better still, ask whether you need gender at all.",
  };
}

function hardcodedGenderDefault(line: string): RawFinding | null {
  if (/^\s*(export\s+)?(type|enum|interface)\b|\|/.test(line)) return null;
  const m = line.match(/(gender|sex)\w*['"]?\s*(?<![=!<>])[:=](?!=)\s*['"](male|female|m|f|man|woman)['"]/i);
  if (!m) return null;
  return {
    ruleId: "gender-default",
    category: "Gender assumptions",
    severity: "medium",
    title: `Gender defaults to "${m[2]}"`,
    explanation:
      "A default value means people who skip the question are recorded with a gender they never chose, which skews your data and can misgender users in emails or UI.",
    suggestion: "Default to null / 'not provided' and handle the missing case explicitly.",
  };
}

const NAME_FIELD = /(first|last|full|given|family|middle|sur|user|display|legal)?_?\s?name|surname|forename/i;

function restrictiveNameValidation(line: string): RawFinding | null {
  if (!NAME_FIELD.test(normalizeLine(line).replace(/ /g, "")) && !NAME_FIELD.test(line)) return null;
  if (/file_?name|filename|class_?name|className|hostname|host_?name|tag_?name|tagName|pathname|path_?name|domain|table_?name|column|key_?name|displayName\s*=\s*['"]\w+['"]$/i.test(line)) return null;
  const classes = line.match(/\[[^\]\n]{1,40}\][+*{]/g) ?? [];
  const asciiOnly = classes.some((c) => {
    const body = c.slice(1, c.lastIndexOf("]"));
    if (/\\p\{|\\u|À|à|À|'/.test(body)) return false;
    const letters = body.replace(/a-z|A-Z|\\s| /g, "");
    return /a-z|A-Z/.test(body) && letters.replace(/[-.]/g, "").length === 0;
  });
  const wordOnly = /\\w\+|\\w\*|\\w\{/.test(line) && /\/\^|\^\\w|"\^|'\^/.test(line);
  if (asciiOnly || wordOnly) {
    return {
      ruleId: "ascii-only-names",
      category: "Name & identity validation",
      severity: "medium",
      title: "Name validation only allows A–Z letters",
      explanation:
        "This pattern rejects real names with accents, apostrophes, hyphens or non-Latin scripts, e.g. José, O'Brien, Nguyễn, Smith-Jones or 李. Those users can't sign up, or are forced to misspell their own name.",
      suggestion:
        "Validate names loosely: check length and strip control characters, but accept any Unicode letters, spaces, apostrophes and hyphens, e.g. /^[\\p{L}\\p{M}' .-]+$/u. Don't try to decide what a 'real' name looks like.",
    };
  }
  const minLen = line.match(/(min_?length|minLength|min)\s*[:=(]\s*([2-9])\b|\.length\s*<\s*([2-9])\b|len\([^)]*\)\s*<\s*([2-9])\b/i);
  if (minLen) {
    return {
      ruleId: "name-min-length",
      category: "Name & identity validation",
      severity: "low",
      title: "Name must have a minimum length",
      explanation:
        "Some people have one-character names, such as many Chinese and Korean given names (e.g. 李 or O). A minimum length above 1 locks them out.",
      suggestion: "Require at least 1 character, and only check for an upper limit that is generous (e.g. 100+).",
    };
  }
  if (/(last|family|sur)[_\s-]?name/i.test(line) && /required\s*[:=]\s*true|\brequired\b(?!\s*[:=]\s*false)|\.required\(\)|NOT NULL/i.test(line)) {
    return {
      ruleId: "last-name-required",
      category: "Name & identity validation",
      severity: "low",
      title: "Last name is required",
      explanation:
        "Many people are mononymous (one name only), which is common in parts of Indonesia, India and Myanmar. A required last name forces them to invent one.",
      suggestion: "Use a single 'Full name' field, or make the family name optional.",
    };
  }
  return null;
}

function titleWithoutMx(line: string): RawFinding | null {
  const titles = line.match(/\b(Mr|Mrs|Ms|Miss|Mx|MR|MRS|MS|MISS|MX)\b/g)?.map((t) => t.toLowerCase()) ?? [];
  const gendered = new Set(titles.filter((t) => t !== "mx"));
  if (gendered.size < 2 || titles.includes("mx")) return null;
  return {
    ruleId: "title-without-mx",
    category: "Gender assumptions",
    severity: "low",
    title: "Title list has no gender-neutral option",
    explanation: "Mr / Mrs / Ms all signal a gender. People who don't want to share theirs have nothing to pick.",
    suggestion: "Add 'Mx' and 'None', and make the title optional.",
  };
}

// ── Runner ────────────────────────────────────────────────────────────────

const LINE_RULES = [
  protectedFeatureInModel,
  protectedAttributeInLogic,
  proxyInLogic,
  genderAsBoolean,
  hardcodedGenderDefault,
  restrictiveNameValidation,
  titleWithoutMx,
];

export function runCodeRules(content: string): RawFinding[] {
  const lines = content.split(/\r?\n/);
  const out: RawFinding[] = [];
  lines.forEach((line, i) => {
    if (line.length > 2000) return; // minified or generated code
    const lineHits: RawFinding[] = [];
    for (const rule of LINE_RULES) {
      const hit = rule(line);
      if (hit) lineHits.push(hit);
    }
    // A model feature list is more specific than the generic "in logic" rule.
    const hasModelHit = lineHits.some((h) => h.ruleId === "protected-feature-in-model");
    const filtered = hasModelHit ? lineHits.filter((h) => h.ruleId !== "protected-attribute-in-logic") : lineHits;
    const binary = binaryGenderOptions(lines, i);
    if (binary && !out.some((f) => f.ruleId === "binary-gender-options" && f.line !== undefined && i + 1 - f.line < 8)) {
      filtered.push(binary);
    }
    for (const f of filtered) out.push({ ...f, line: i + 1, snippet: snippetOf(line) });
  });
  return out;
}
