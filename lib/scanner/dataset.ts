// Dataset checks. Parsing and profiling run in the browser so raw rows never
// leave the developer's machine; only the aggregate profile is sent to the
// server, which turns it into findings.

import type { DatasetProfile, Finding, GroupStat, SensitiveColumnStats } from "./types";
import { lineWords } from "./text";

type RawFinding = Omit<Finding, "id" | "source">;

export const MAX_ROWS = 200_000;
const MISSING = new Set(["", "na", "n/a", "null", "none", "nan", "undefined", "-", "?"]);
const MIN_GROUP_FOR_RATES = 10;

export type ParsedCsv = { headers: string[]; rows: string[][]; truncated: boolean };

function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t", "|"].map((d) => [d, firstLine.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ",";
}

/** RFC 4180-style CSV parser (quoted fields, escaped quotes, newlines inside quotes). */
export function parseCsv(text: string, maxRows = MAX_ROWS): ParsedCsv {
  const src = text.replace(/^﻿/, "");
  const delim = detectDelimiter(src.slice(0, src.indexOf("\n") === -1 ? undefined : src.indexOf("\n")));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let truncated = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      if (rows.length > maxRows) {
        truncated = true;
        break;
      }
    } else field += c;
  }
  if (!truncated && (field !== "" || row.length > 0)) {
    row.push(field);
    if (row.some((v) => v !== "")) rows.push(row);
  }

  const headers = (rows.shift() ?? []).map((h, i) => h.trim() || `column_${i + 1}`);
  return { headers, rows: rows.slice(0, maxRows), truncated };
}

const isMissing = (v: string | undefined) => v === undefined || MISSING.has(v.trim().toLowerCase());

const SENSITIVE_WORDS = new Set([
  "gender", "sex", "race", "ethnicity", "ethnic", "religion", "religious", "nationality", "citizenship",
  "disability", "disabled", "age", "dob", "birthdate", "birthday", "marital", "veteran", "pregnant",
  "pregnancy", "orientation", "caste",
]);

const PROXY_HEADERS: [RegExp, string][] = [
  [/\b(zip|zipcode|postcode|postal)\b/, "postal code"],
  [/\bneighbou?rhood\b/, "neighbourhood"],
  [/\b(surname|last name|family name)\b/, "surname"],
  [/\bfirst name\b|\bforename\b|\bgiven name\b/, "first name"],
  [/\bgraduation (year|date)\b/, "graduation year"],
  [/\b(primary|native|first) language\b/, "language"],
];

const POSITIVE_VALUES = [
  "1", "true", "yes", "y", "approved", "accepted", "hired", "admitted", "pass", "passed", "selected",
  "granted", "positive", "success", "offer", "won", "eligible",
];

const TARGET_WORDS = new Set([
  "hired", "approved", "accepted", "label", "target", "outcome", "decision", "selected", "admitted",
  "passed", "default", "defaulted", "churn", "churned", "prediction", "predicted", "result", "y",
  "offer", "granted", "eligible", "class",
]);

function words(header: string): Set<string> {
  return lineWords(header);
}

function isSensitiveHeader(h: string): boolean {
  const w = words(h);
  if (/date of birth|birth (date|year)|year of birth/i.test(h)) return true;
  return [...w].some((x) => SENSITIVE_WORDS.has(x));
}

function isAgeLike(h: string): boolean {
  const w = words(h);
  return w.has("age") || w.has("dob") || w.has("birthdate") || /birth/i.test(h);
}

export type ColumnInfo = {
  name: string;
  type: "numeric" | "categorical";
  missing: number;
  distinct: number;
  binaryValues?: [string, string];
};

export type ColumnSuggestions = {
  columns: ColumnInfo[];
  sensitive: string[];
  target?: { column: string; positiveValue: string };
};

export function inspectColumns(parsed: ParsedCsv): ColumnSuggestions {
  const columns: ColumnInfo[] = parsed.headers.map((name, ci) => {
    const seen = new Map<string, number>();
    let missing = 0;
    let numeric = 0;
    for (const r of parsed.rows) {
      const v = r[ci];
      if (isMissing(v)) {
        missing++;
        continue;
      }
      const t = v.trim();
      if (t !== "" && !Number.isNaN(Number(t))) numeric++;
      if (seen.size <= 1000) seen.set(t.toLowerCase(), (seen.get(t.toLowerCase()) ?? 0) + 1);
    }
    const present = parsed.rows.length - missing;
    const info: ColumnInfo = {
      name,
      type: present > 0 && numeric / present > 0.95 && seen.size > 2 ? "numeric" : "categorical",
      missing,
      distinct: seen.size,
    };
    if (seen.size === 2) info.binaryValues = [...seen.keys()] as [string, string];
    return info;
  });

  const sensitive = columns.filter((c) => isSensitiveHeader(c.name)).map((c) => c.name);

  const binaries = columns.filter((c) => c.binaryValues && !sensitive.includes(c.name));
  const named = binaries.find((c) => [...words(c.name)].some((w) => TARGET_WORDS.has(w)));
  const chosen = named ?? (binaries.length === 1 ? binaries[0] : undefined);
  const target = chosen ? { column: chosen.name, positiveValue: pickPositive(chosen.binaryValues!) } : undefined;

  return { columns, sensitive, target };
}

export function pickPositive(values: [string, string]): string {
  const lower = values.map((v) => v.toLowerCase());
  for (const p of POSITIVE_VALUES) {
    const i = lower.indexOf(p);
    if (i !== -1) return values[i];
  }
  return [...values].sort()[1];
}

function ageBucket(age: number): string {
  if (age < 25) return "Under 25";
  if (age < 40) return "25–39";
  if (age < 55) return "40–54";
  return "55 and over";
}

const AGE_ORDER = ["Under 25", "25–39", "40–54", "55 and over"];

function toAge(raw: string, header: string): number | null {
  const t = raw.trim();
  const n = Number(t);
  const thisYear = new Date().getFullYear();
  if (!Number.isNaN(n)) {
    if (/birth|dob/i.test(header) && n > 1900 && n <= thisYear) return thisYear - n; // year of birth
    return n >= 0 && n < 130 ? n : null;
  }
  const d = Date.parse(t);
  if (!Number.isNaN(d)) {
    const age = (Date.now() - d) / (365.25 * 24 * 3600 * 1000);
    return age >= 0 && age < 130 ? Math.floor(age) : null;
  }
  return null;
}

export function buildProfile(
  parsed: ParsedCsv,
  opts: { fileName?: string; sensitive: string[]; target?: { column: string; positiveValue: string } },
): DatasetProfile {
  const info = inspectColumns(parsed);
  const total = parsed.rows.length;
  const ti = opts.target ? parsed.headers.indexOf(opts.target.column) : -1;
  const positiveKey = opts.target?.positiveValue.trim().toLowerCase();
  const isPositive = (r: string[]) => (ti === -1 || isMissing(r[ti]) ? null : r[ti].trim().toLowerCase() === positiveKey);

  let targetPos = 0;
  let targetN = 0;
  if (ti !== -1) {
    for (const r of parsed.rows) {
      const p = isPositive(r);
      if (p === null) continue;
      targetN++;
      if (p) targetPos++;
    }
  }

  const sensitive: SensitiveColumnStats[] = opts.sensitive
    .filter((c) => parsed.headers.includes(c) && c !== opts.target?.column)
    .map((column) => {
      const ci = parsed.headers.indexOf(column);
      const colInfo = info.columns[ci];
      const asAge = isAgeLike(column) && (colInfo.type === "numeric" || /birth|dob/i.test(column));
      const groups = new Map<string, { label: string; count: number; pos: number; n: number }>();
      let missing = 0;
      for (const r of parsed.rows) {
        const v = r[ci];
        if (isMissing(v)) {
          missing++;
          continue;
        }
        let label: string;
        if (asAge) {
          const age = toAge(v, column);
          if (age === null) {
            missing++;
            continue;
          }
          label = ageBucket(age);
        } else label = v.trim();
        const key = label.toLowerCase();
        const g = groups.get(key) ?? { label, count: 0, pos: 0, n: 0 };
        g.count++;
        const p = isPositive(r);
        if (p !== null) {
          g.n++;
          if (p) g.pos++;
        }
        groups.set(key, g);
      }

      let list = [...groups.values()];
      if (asAge) list.sort((a, b) => AGE_ORDER.indexOf(a.label) - AGE_ORDER.indexOf(b.label));
      else list.sort((a, b) => b.count - a.count);
      if (!asAge && list.length > 12) {
        const rest = list.slice(11);
        list = [
          ...list.slice(0, 11),
          rest.reduce((acc, g) => ({ label: "Other", count: acc.count + g.count, pos: acc.pos + g.pos, n: acc.n + g.n }), {
            label: "Other", count: 0, pos: 0, n: 0,
          }),
        ];
      }
      const present = total - missing;
      const stats: GroupStat[] = list.map((g) => ({
        group: g.label,
        count: g.count,
        share: present > 0 ? g.count / present : 0,
        ...(ti !== -1 && g.n > 0 ? { positiveRate: g.pos / g.n } : {}),
      }));

      const disparateImpact = ti !== -1 ? disparateImpactOf(stats) : undefined;
      return { column, kind: asAge ? "age-buckets" : "categorical", missing, groups: stats, disparateImpact };
    });

  const proxyColumns = parsed.headers.filter((h) => {
    const norm = [...words(h)].join(" ");
    return PROXY_HEADERS.some(([re]) => re.test(norm));
  });

  return {
    fileName: opts.fileName,
    rowCount: total,
    truncated: parsed.truncated,
    columns: info.columns.map(({ name, type, missing, distinct }) => ({ name, type, missing, distinct })),
    ...(ti !== -1 && targetN > 0
      ? { target: { column: opts.target!.column, positiveValue: opts.target!.positiveValue, positiveRate: targetPos / targetN } }
      : {}),
    sensitive,
    proxyColumns,
  };
}

/** Groups large enough to compare outcome rates for. */
function ratedGroups(groups: GroupStat[]): GroupStat[] {
  return groups.filter((g) => g.group !== "Other" && g.positiveRate !== undefined && g.count >= MIN_GROUP_FOR_RATES);
}

/** Lowest positive rate / highest positive rate across groups (four-fifths rule ratio). */
export function disparateImpactOf(groups: GroupStat[]): number | undefined {
  const rates = ratedGroups(groups).map((g) => g.positiveRate!);
  if (rates.length < 2) return undefined;
  const max = Math.max(...rates);
  return max > 0 ? Math.min(...rates) / max : undefined;
}

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

export function datasetFindings(p: DatasetProfile): RawFinding[] {
  const out: RawFinding[] = [];

  if (p.rowCount === 0) {
    out.push({
      ruleId: "dataset-empty", category: "Data quality", severity: "info", title: "No rows found",
      explanation: "The file has a header row but no data, or it isn't a CSV.", suggestion: "Check the file and its delimiter.",
    });
    return out;
  }

  if (p.sensitive.length === 0) {
    out.push({
      ruleId: "dataset-no-demographics",
      category: "Data quality",
      severity: "info",
      title: "No demographic columns to audit against",
      explanation:
        "FairCheck couldn't find columns like gender, race, age or disability, so it can't measure whether outcomes differ between groups. Bias can still be present, hidden in other columns.",
      suggestion:
        "If you hold demographic data separately, join it in for the audit only (not for training). Otherwise, pick the columns manually in the column picker.",
    });
  }

  for (const s of p.sensitive) {
    const missingShare = s.missing / p.rowCount;
    if (missingShare > 0.2) {
      out.push({
        ruleId: "dataset-missing-sensitive",
        category: "Data quality",
        severity: "medium",
        title: `${s.column} is missing for ${pct(missingShare)} of rows`,
        explanation:
          "When demographic data is missing this often, any fairness numbers are unreliable, and the missing rows are often not random (some groups skip the question more).",
        suggestion: "Check whether missingness differs by outcome, and report results with and without the missing rows.",
        snippet: `${s.missing.toLocaleString()} of ${p.rowCount.toLocaleString()} rows blank`,
      });
    }

    const real = s.groups.filter((g) => g.group !== "Other");
    if (real.length >= 2) {
      const small = real.filter((g) => g.count < 30 || g.share < 0.05);
      if (small.length > 0) {
        out.push({
          ruleId: "dataset-small-group",
          category: "Dataset representation",
          severity: small.some((g) => g.count < 30) ? "medium" : "low",
          title: `Some ${s.column} groups are barely represented`,
          explanation: `${small.map((g) => `"${g.group}" has ${g.count.toLocaleString()} rows (${pct(g.share)})`).join("; ")}. A model trained on this will be least accurate for exactly these people, and you can't reliably measure fairness for them.`,
          suggestion:
            "Collect more data for these groups, or reweight/resample during training. Report per-group accuracy, not just the overall number.",
          snippet: real.map((g) => `${g.group}: ${pct(g.share)}`).join(", "),
        });
      }
      const top = real.reduce((a, b) => (a.share > b.share ? a : b));
      if (top.share > 0.8) {
        out.push({
          ruleId: "dataset-dominant-group",
          category: "Dataset representation",
          severity: "medium",
          title: `${pct(top.share)} of rows are "${top.group}" (${s.column})`,
          explanation:
            "One group dominates the data, so the model mostly learns patterns that fit them. This is how face recognition ended up far less accurate for darker-skinned women.",
          suggestion: "Compare against the real population the system will serve, and rebalance or collect more data if it doesn't match.",
          snippet: real.map((g) => `${g.group}: ${pct(g.share)}`).join(", "),
        });
      }
    }

    const di = p.target ? disparateImpactOf(s.groups) : undefined;
    if (di !== undefined && p.target) {
      const rated = ratedGroups(s.groups);
      const hi = rated.reduce((a, b) => ((a.positiveRate ?? 0) > (b.positiveRate ?? 0) ? a : b));
      const lo = rated.reduce((a, b) => ((a.positiveRate ?? 1) < (b.positiveRate ?? 1) ? a : b));
      if (di < 0.9) {
        out.push({
          ruleId: "dataset-disparate-impact",
          category: "Outcome disparity",
          severity: di < 0.8 ? "high" : "medium",
          title: `"${p.target.column} = ${p.target.positiveValue}" happens far less for "${lo.group}" (${s.column})`,
          explanation: `${pct(lo.positiveRate!)} of "${lo.group}" rows get the positive outcome versus ${pct(hi.positiveRate!)} for "${hi.group}", a ratio of ${di.toFixed(2)}. ${
            di < 0.8
              ? "That fails the four-fifths (80%) rule US regulators use as a first test for disparate impact."
              : "That's close to the four-fifths (80%) rule regulators use as a first test for disparate impact."
          } A model trained on these labels will learn to repeat the gap.`,
          suggestion:
            "Find out why: is the gap explained by a legitimate, job- or risk-related factor? If not, fix the labels or use fairness-aware training (reweighing, threshold adjustment per Fairlearn / AIF360), then re-measure.",
          snippet: rated.map((g) => `${g.group}: ${pct(g.positiveRate!)}`).join(", "),
        });
      }
    }
  }

  if (p.target && p.sensitive.length > 0) {
    out.push({
      ruleId: "dataset-sensitive-in-training",
      category: "ML training features",
      severity: "low",
      title: `Keep ${p.sensitive.map((s) => s.column).join(", ")} out of the model's inputs`,
      explanation:
        "This file holds both demographic columns and an outcome. That's good for auditing, but if it's used as-is for training, the model can learn from protected traits directly.",
      suggestion: `Drop ${p.sensitive.map((s) => `"${s.column}"`).join(", ")} from the feature set before training, and keep them only to measure per-group results.`,
    });
  }

  if (p.proxyColumns.length > 0 && p.target) {
    out.push({
      ruleId: "dataset-proxy-columns",
      category: "Proxy variable",
      severity: "medium",
      title: `Possible proxy columns: ${p.proxyColumns.join(", ")}`,
      explanation:
        "Postal codes, names, graduation years and language often correlate strongly with race, ethnicity, gender or age. A model can use them to discriminate even when protected columns are removed.",
      suggestion:
        "Check how strongly each one predicts the protected traits. Drop or coarsen it (e.g. region instead of postal code) unless it is clearly necessary.",
    });
  }

  if (p.truncated) {
    out.push({
      ruleId: "dataset-truncated",
      category: "Data quality",
      severity: "info",
      title: `Only the first ${MAX_ROWS.toLocaleString()} rows were analysed`,
      explanation: "The file is larger than the browser limit, so results are based on a sample from the top of the file.",
      suggestion: "If the file is sorted, shuffle it first so the sample is representative.",
    });
  }

  return out;
}
