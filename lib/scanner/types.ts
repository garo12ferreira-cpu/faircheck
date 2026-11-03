// Shared types for the FairCheck scanner. Pure TypeScript, safe to import
// from both the browser and the server.

export type ScanMode = "code" | "text" | "dataset";

export type Severity = "high" | "medium" | "low" | "info";

export type RiskLevel = "High" | "Medium" | "Low";

export type Category =
  | "Protected attribute in logic"
  | "Proxy variable"
  | "Gender assumptions"
  | "Name & identity validation"
  | "Inclusive language"
  | "ML training features"
  | "Dataset representation"
  | "Outcome disparity"
  | "Data quality"
  | "Other";

export type Finding = {
  id: string;
  source: "rule" | "ai";
  ruleId?: string;
  category: Category;
  severity: Severity;
  title: string;
  explanation: string;
  suggestion: string;
  line?: number;
  snippet?: string;
  /** Set when the AI reviewer judged a rule hit to be a false positive. */
  aiNote?: string;
};

export type GroupStat = {
  group: string;
  count: number;
  share: number;
  /** Share of rows in this group with a positive outcome (only when a target column is chosen). */
  positiveRate?: number;
};

export type SensitiveColumnStats = {
  column: string;
  kind: "categorical" | "age-buckets";
  missing: number;
  groups: GroupStat[];
  /** Lowest positive rate divided by highest positive rate (the "four-fifths rule" ratio). */
  disparateImpact?: number;
};

export type DatasetProfile = {
  fileName?: string;
  rowCount: number;
  truncated: boolean;
  columns: { name: string; type: "numeric" | "categorical"; missing: number; distinct: number }[];
  target?: { column: string; positiveValue: string; positiveRate: number };
  sensitive: SensitiveColumnStats[];
  proxyColumns: string[];
};

export type ScanReport = {
  version: 2;
  mode: ScanMode;
  title: string;
  language?: string;
  risk: RiskLevel;
  summary: string;
  aiReviewed: boolean;
  counts: Record<Severity, number>;
  findings: Finding[];
  dataset?: DatasetProfile;
  /** Code or text that was scanned (kept so the report can show annotated lines). */
  content?: string;
  createdAt: string;
};
