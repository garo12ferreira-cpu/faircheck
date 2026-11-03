// Entry point for the rule-based scanner. Pure functions, no network.

import { runCodeRules } from "./code-rules";
import { datasetFindings, disparateImpactOf } from "./dataset";
import { runLanguageRules } from "./language-rules";
import type { DatasetProfile, Finding, RiskLevel, ScanMode, Severity } from "./types";

export * from "./types";
export { detectLanguage } from "./text";

const SEVERITY_ORDER: Severity[] = ["high", "medium", "low", "info"];

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      (a.line ?? Infinity) - (b.line ?? Infinity),
  );
}

export function runRules(mode: ScanMode, input: { content?: string; dataset?: DatasetProfile }): Finding[] {
  const raw =
    mode === "dataset"
      ? input.dataset
        ? datasetFindings(input.dataset)
        : []
      : [...runCodeRules(input.content ?? ""), ...runLanguageRules(input.content ?? "")];
  return sortFindings(raw.map((f, i) => ({ ...f, id: `r${i + 1}`, source: "rule" as const })));
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

export function riskLevel(findings: Finding[]): RiskLevel {
  const c = countBySeverity(findings);
  if (c.high > 0) return "High";
  if (c.medium > 0 || c.low >= 4) return "Medium";
  return "Low";
}

export function ruleSummary(mode: ScanMode, findings: Finding[]): string {
  const c = countBySeverity(findings);
  const issues = c.high + c.medium + c.low;
  if (issues === 0) {
    return mode === "dataset"
      ? "No representation or outcome problems were found in the columns checked."
      : "No bias patterns were found. Automated checks can't catch everything, so still review decisions that affect people.";
  }
  const parts = [
    c.high && `${c.high} high`,
    c.medium && `${c.medium} medium`,
    c.low && `${c.low} low`,
  ].filter(Boolean);
  const next =
    c.high > 0
      ? "Start with the high-severity ones: they are the most likely to treat people unfairly."
      : c.medium > 0
        ? "Nothing high-severity, but the medium ones can still exclude or misrepresent people."
        : "These are mostly wording fixes: quick to change and worth doing.";
  return `Found ${issues} issue${issues === 1 ? "" : "s"} (${parts.join(", ")} severity). ${next}`;
}

// ── Input validation for profiles sent from the browser ─────────────────

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0;
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

/** Rebuilds a DatasetProfile from untrusted JSON, dropping anything unexpected. */
export function sanitizeProfile(input: unknown): DatasetProfile | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const target = p.target as Record<string, unknown> | undefined;
  const profile: DatasetProfile = {
    fileName: str(p.fileName) || undefined,
    rowCount: num(p.rowCount),
    truncated: p.truncated === true,
    columns: arr(p.columns, 300).map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        name: str(o.name),
        type: o.type === "numeric" ? ("numeric" as const) : ("categorical" as const),
        missing: num(o.missing),
        distinct: num(o.distinct),
      };
    }),
    target:
      target && typeof target === "object"
        ? { column: str(target.column), positiveValue: str(target.positiveValue), positiveRate: num(target.positiveRate, 0, 1) }
        : undefined,
    sensitive: arr(p.sensitive, 20).map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const groups = arr(o.groups, 13).map((g) => {
        const go = (g ?? {}) as Record<string, unknown>;
        return {
          group: str(go.group, 80),
          count: num(go.count),
          share: num(go.share, 0, 1),
          ...(typeof go.positiveRate === "number" ? { positiveRate: num(go.positiveRate, 0, 1) } : {}),
        };
      });
      return {
        column: str(o.column),
        kind: o.kind === "age-buckets" ? ("age-buckets" as const) : ("categorical" as const),
        missing: num(o.missing),
        groups,
        disparateImpact: target ? disparateImpactOf(groups) : undefined,
      };
    }),
    proxyColumns: arr(p.proxyColumns, 30).map((c) => str(c)).filter(Boolean),
  };
  return profile;
}
