"use client";

import { useMemo, useRef, useState } from "react";

import { reportToMarkdown } from "@/lib/report-markdown";
import type { Finding, ScanReport, Severity } from "@/lib/scanner/types";
import { DatasetCharts } from "./DatasetCharts";

const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low", info: "Info" };
const SEV_ICON: Record<Severity, string> = { high: "✕", medium: "!", low: "i", info: "·" };
const SEV_RANK: Severity[] = ["high", "medium", "low", "info"];
const MODE_LABEL = { code: "Code", text: "UI text & names", dataset: "Dataset" } as const;

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

function RiskBadge({ risk }: { risk: ScanReport["risk"] }) {
  const cls = risk === "High" ? "sev-high" : risk === "Medium" ? "sev-medium" : "sev-good";
  const icon = risk === "High" ? "✕" : risk === "Medium" ? "!" : "✓";
  return (
    <span className={`pill ${cls}`} style={{ fontSize: "0.8rem", padding: "5px 12px" }}>
      {icon} {risk} risk
    </span>
  );
}

function FindingCard({ f, active, onSelect }: { f: Finding; active: boolean; onSelect: () => void }) {
  return (
    <article
      id={`finding-${f.id}`}
      className="card p-4 transition-colors"
      style={{ borderColor: active ? "rgba(59,130,246,0.55)" : undefined, background: f.severity === "info" ? "transparent" : undefined }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`pill sev-${f.severity}`}>
          {SEV_ICON[f.severity]} {SEV_LABEL[f.severity]}
        </span>
        <span className="text-xs" style={{ color: "var(--text-3)" }}>{f.category}</span>
        <span className="text-xs" style={{ color: "var(--text-3)" }}>· {f.source === "ai" ? "AI review" : "Rule"}</span>
        {f.line && (
          <button type="button" onClick={onSelect} className="mono ml-auto text-xs hover:underline" style={{ color: "#93c5fd" }}>
            Line {f.line} →
          </button>
        )}
      </div>
      <h4 className="mb-1 font-semibold leading-snug">{f.title}</h4>
      {f.snippet && (
        <pre className="mono my-2 overflow-x-auto rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(0,0,0,0.3)", color: "#c9d1d9" }}>
          {f.snippet}
        </pre>
      )}
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{f.explanation}</p>
      <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)" }}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--good)" }}>How to fix</p>
          <CopyButton text={f.suggestion} />
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--text)" }}>{f.suggestion}</p>
      </div>
      {f.aiNote && (
        <p className="mt-3 text-xs italic" style={{ color: "var(--text-3)" }}>
          AI review marked this as probably fine: {f.aiNote}
        </p>
      )}
    </article>
  );
}

function CodeView({
  content,
  findings,
  activeLine,
  onLineClick,
}: {
  content: string;
  findings: Finding[];
  activeLine: number | null;
  onLineClick: (line: number) => void;
}) {
  const worstByLine = useMemo(() => {
    const m = new Map<number, Severity>();
    for (const f of findings) {
      if (!f.line) continue;
      const cur = m.get(f.line);
      if (!cur || SEV_RANK.indexOf(f.severity) < SEV_RANK.indexOf(cur)) m.set(f.line, f.severity);
    }
    return m;
  }, [findings]);
  const lines = content.split(/\r?\n/);
  return (
    <div className="code-view mono overflow-auto py-3" style={{ maxHeight: "70vh" }}>
      {lines.map((l, i) => {
        const n = i + 1;
        const sev = worstByLine.get(n);
        return (
          <div
            key={n}
            id={`code-line-${n}`}
            className={`code-line ${sev ? `hit-${sev}` : ""} ${activeLine === n ? "active" : ""}`}
            data-clickable={sev ? "true" : "false"}
            onClick={sev ? () => onLineClick(n) : undefined}
          >
            <span className="ln">{n}</span>
            <code>{l || " "}</code>
          </div>
        );
      })}
    </div>
  );
}

export function ReportView({ report }: { report: ScanReport }) {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const codeRef = useRef<HTMLDivElement>(null);

  const visible = report.findings.filter((f) => filter === "all" || f.severity === filter);
  const active = report.findings.find((f) => f.id === activeId) ?? null;
  const hasCode = Boolean(report.content) && report.mode !== "dataset";

  const goToLine = (line: number) => {
    const el = codeRef.current?.querySelector<HTMLElement>(`#code-line-${line}`);
    const box = el?.closest<HTMLElement>(".code-view");
    if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 3, behavior: "smooth" });
  };

  const selectFinding = (f: Finding) => {
    setActiveId(f.id);
    if (f.line) goToLine(f.line);
  };

  const selectLine = (line: number) => {
    const f = report.findings.find((x) => x.line === line);
    if (!f) return;
    setActiveId(f.id);
    if (filter !== "all" && f.severity !== filter) setFilter("all");
    requestAnimationFrame(() => document.getElementById(`finding-${f.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const markdown = reportToMarkdown(report);
  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `faircheck-${report.title.replace(/[^\w.-]+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const issueCount = report.counts.high + report.counts.medium + report.counts.low;

  return (
    <div className="flex flex-col gap-5">
      {/* Summary */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <RiskBadge risk={report.risk} />
              <span className="pill">{MODE_LABEL[report.mode]}</span>
              {report.language && report.language !== "Unknown" && <span className="pill">{report.language}</span>}
              <span className="pill" title={report.aiReviewed ? "Checked by the rule engine and by AI" : "AI review was unavailable"}>
                {report.aiReviewed ? "Rules + AI review" : "Rules only"}
              </span>
            </div>
            <h2 className="mono truncate text-lg font-semibold">{report.title}</h2>
          </div>
          <div className="flex gap-2">
            <CopyButton text={markdown} label="Copy as Markdown" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={download}>
              Download .md
            </button>
          </div>
        </div>
        <p className="mt-4 max-w-3xl leading-relaxed" style={{ color: "var(--text-2)" }}>{report.summary}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["high", "medium", "low", "info"] as Severity[]).map((s) => (
            <div key={s} className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-bold">{report.counts[s]}</p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                {SEV_ICON[s]} {SEV_LABEL[s]}
                {s === "info" ? " / dismissed" : " severity"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {report.dataset && <DatasetCharts dataset={report.dataset} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Filter findings by severity">
        {(["all", "high", "medium", "low", "info"] as const).map((s) => {
          const n = s === "all" ? report.findings.length : report.counts[s];
          return (
            <button key={s} type="button" role="tab" aria-selected={filter === s} className="tab" onClick={() => setFilter(s)}>
              {s === "all" ? "All" : SEV_LABEL[s]} <span style={{ color: "var(--text-3)" }}>({n})</span>
            </button>
          );
        })}
      </div>

      <div className={`grid grid-cols-[minmax(0,1fr)] gap-5 ${hasCode ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : ""}`}>
        <div className="flex flex-col gap-3">
          {visible.length === 0 && (
            <div className="card p-8 text-center" style={{ color: "var(--text-3)" }}>
              {issueCount === 0 && filter === "all" ? "✓ Nothing to fix here." : "No findings at this level."}
            </div>
          )}
          {visible.map((f) => (
            <FindingCard key={f.id} f={f} active={f.id === activeId} onSelect={() => selectFinding(f)} />
          ))}
        </div>
        {hasCode && (
          <div ref={codeRef} className="lg:sticky lg:top-24 lg:self-start">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 text-xs" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)" }}>
                <span className="mono">{report.title}</span>
                <span>{active?.line ? `Line ${active.line}` : "Click a highlighted line"}</span>
              </div>
              <CodeView content={report.content!} findings={report.findings} activeLine={active?.line ?? null} onLineClick={selectLine} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
