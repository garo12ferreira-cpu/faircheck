// Combines rule findings and the AI review into one report. Server only.

import { aiReview } from "./ai-review";
import { countBySeverity, riskLevel, ruleSummary, runRules, sortFindings } from "./scanner";
import type { DatasetProfile, Finding, ScanMode, ScanReport } from "./scanner/types";

export async function buildReport(args: {
  mode: ScanMode;
  title: string;
  language?: string;
  content?: string;
  dataset?: DatasetProfile;
}): Promise<ScanReport> {
  const ruleFindings = runRules(args.mode, { content: args.content, dataset: args.dataset });

  let ai = null;
  try {
    ai = await aiReview({ ...args, ruleFindings });
  } catch (err) {
    console.error("AI review failed:", err);
  }

  let findings: Finding[] = ruleFindings;
  if (ai) {
    findings = ruleFindings.map((f) => {
      const review = ai.reviews.get(f.id);
      if (!review?.falsePositive) return f;
      return { ...f, severity: "info", aiNote: review.note || "AI review: probably fine in this context." };
    });
    findings = sortFindings([...findings, ...ai.findings]);
  }

  const summary = ai?.summary?.trim() || ruleSummary(args.mode, findings);
  const aiNote = ai ? "" : " (AI review unavailable: showing rule-based results only.)";

  return {
    version: 2,
    mode: args.mode,
    title: args.title,
    language: args.language,
    risk: riskLevel(findings),
    summary: summary + aiNote,
    aiReviewed: Boolean(ai),
    counts: countBySeverity(findings),
    findings,
    dataset: args.dataset,
    content: args.content,
    createdAt: new Date().toISOString(),
  };
}
