// Helpers for turning source lines into words we can match against.

/** "applicantGender_v2" -> "applicant gender v2"; "MASTER_SLAVE" -> "master slave". */
export function normalizeLine(line: string): string {
  return line
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
}

/** Every word that appears inside identifiers or strings on the line. */
export function lineWords(line: string): Set<string> {
  return new Set(normalizeLine(line).match(/[a-z]+/g) ?? []);
}

const COMMENT_ONLY = /^\s*(\/\/|#|\/\*|\*|<!--|--)/;

export function isCommentLine(line: string): boolean {
  return COMMENT_ONLY.test(line);
}

export function snippetOf(line: string): string {
  const trimmed = line.trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
}

export function detectLanguage(fileName: string | undefined, content: string): string {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript (React)", js: "JavaScript", jsx: "JavaScript (React)",
    mjs: "JavaScript", cjs: "JavaScript", py: "Python", ipynb: "Python notebook", java: "Java",
    kt: "Kotlin", cs: "C#", go: "Go", rb: "Ruby", php: "PHP", rs: "Rust", swift: "Swift",
    sql: "SQL", html: "HTML", vue: "Vue", svelte: "Svelte", json: "JSON", yml: "YAML",
    yaml: "YAML", md: "Markdown", txt: "Plain text", r: "R", scala: "Scala", dart: "Dart",
  };
  if (ext && byExt[ext]) return byExt[ext];
  if (/^\s*(def |import \w+|from \w+ import)/m.test(content)) return "Python";
  if (/\b(const|let|function|=>|interface|export)\b/.test(content)) return "JavaScript / TypeScript";
  if (/\bSELECT\b[\s\S]*\bFROM\b/i.test(content)) return "SQL";
  return "Unknown";
}
