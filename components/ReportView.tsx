"use client";

import { useMemo, useRef, useState } from "react";

import { reportToMarkdown } from "@/lib/report-markdown";
import type { Finding, ScanReport, Severity } from "@/lib/scanner/types";
import { DatasetCharts } from "./DatasetCharts";

const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low", info: "Note" };
const SEV_RANK: Severity[] = ["high", "medium", "low", "info"];
const SEV_BORDER: Record<Severity, string> = { high: "var(--high)", medium: "var(--medium)", low: "var(--low)", info: "var(--rule-strong)" };
const MODE_LABEL = { code: "Code", text: "Interface text and names", dataset: "Dataset" } as const;

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet btn-sm"
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
      {done ? "Copied" : label}
    </button>
  );
}

function FindingItem({ f, active, onSelect }: { f: Finding; active: boolean; onSelect: () => void }) {
  return (
    <li
      id={`finding-${f.id}`}
      className="border-l-[3px] py-5 pl-5 pr-1"
      style={{ borderColor: SEV_BORDER[f.severity], background: active ? "var(--paper-2)" : undefined }}
    >
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`sev sev-${f.severity}`}>{SEV_LABEL[f.severity]}</span>
        <span className="t-small muted">{f.category}</span>
        {f.source === "ai" && <span className="t-small muted">(AI review)</span>}
        {f.line && (
          <button type="button" onClick={onSelect} className="mono t-small text-link ml-auto">
            Line {f.line}
          </button>
        )}
      </div>
      <h4 className="text-[1.05rem] font-bold leading-snug">{f.title}</h4>
      {f.snippet && (
        <pre className="mono mt-2 overflow-x-auto rounded px-3 py-2 text-[0.8rem]" style={{ background: "var(--paper-2)", border: "1px solid var(--rule)" }}>
          {f.snippet}
        </pre>
      )}
      <p className="mt-2 max-w-[70ch] soft">{f.explanation}</p>
      <div className="mt-3 rounded px-4 py-3" style={{ background: "var(--good-bg)" }}>
        <div className="flex items-center justify-between gap-2">
          <p className="t-small font-bold" style={{ color: "var(--good)" }}>Suggested change</p>
          <CopyButton text={f.suggestion} />
        </div>
        <p className="mt-0.5 max-w-[70ch] whitespace-pre-wrap">{f.suggestion}</p>
      </div>
      {f.aiNote && <p className="mt-3 t-small italic muted">The AI review thinks this one is probably fine: {f.aiNote}</p>}
    </li>
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
  return (
    <div className="code-view overflow-auto py-3" style={{ maxHeight: "72vh" }}>
      {content.split(/\r?\n/).map((l, i) => {
        const n = i + 1;
        const sev = worstByLine.get(n);
        return (
          <div
            key={n}
            id={`code-line-${n}`}
            className={`code-line ${sev ? `hit-${sev}` : ""} ${activeLine === n ? "active" : ""}`}
            data-clickable={sev ? "true" : "false"}
            onClick={sev ? () => onLineClick(n) : undefined}
            title={sev ? `${SEV_LABEL[sev]}: click to see the note` : undefined}
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
  const issueCount = report.counts.high + report.counts.medium + report.counts.low;

  const goToLine = (line: number) => {
    const el = codeRef.current?.querySelector<HTMLElement>(`#code-line-${line}`);
    const box = el?.closest<HTMLElement>(".code-view");
    if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 3, behavior: "smooth" });
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

  const riskSev = report.risk === "High" ? "high" : report.risk === "Medium" ? "medium" : "good";

  return (
    <div className="flex flex-col gap-8">
      {/* Summary */}
      <section className="border-b pb-8" style={{ borderColor: "var(--rule)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="t-small muted">
              {MODE_LABEL[report.mode]}
              {report.language && report.language !== "Unknown" ? `, ${report.language}` : ""}
              {report.aiReviewed ? ", checked by rules and AI review" : ", checked by rules only"}
            </p>
            <h2 className="mt-1 t-h2">
              <span className={`sev-${riskSev}`}>{report.risk} risk</span>{" "}
              <span className="font-normal soft">in</span> <span className="mono text-[0.8em] break-all">{report.title}</span>
            </h2>
          </div>
          <div className="flex gap-2">
            <CopyButton text={markdown} label="Copy as Markdown" />
            <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
              Download report
            </button>
          </div>
        </div>
        <p className="mt-4 max-w-[70ch] text-[1.05rem]">{report.summary}</p>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
          {(["high", "medium", "low"] as Severity[]).map((s) => (
            <span key={s} className={`sev ${report.counts[s] ? `sev-${s}` : "sev-info"}`}>
              {report.counts[s]} {SEV_LABEL[s].toLowerCase()}
            </span>
          ))}
          {report.counts.info > 0 && (
            <span className="sev sev-info">
              {report.counts.info} {report.counts.info === 1 ? "note" : "notes"}
            </span>
          )}
        </p>
      </section>

      {report.dataset && <DatasetCharts dataset={report.dataset} />}

      <div className={`grid grid-cols-[minmax(0,1fr)] gap-8 ${hasCode ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : ""}`}>
        <div>
          <div className="segmented mb-4" role="tablist" aria-label="Show findings by severity">
            {(["all", "high", "medium", "low", "info"] as const).map((s) => {
              const n = s === "all" ? report.findings.length : report.counts[s];
              if (s !== "all" && n === 0) return null;
              return (
                <button key={s} type="button" role="tab" aria-selected={filter === s} onClick={() => setFilter(s)}>
                  {s === "all" ? "All" : SEV_LABEL[s]} ({n})
                </button>
              );
            })}
          </div>
          {visible.length === 0 ? (
            <p className="py-10 soft">{issueCount === 0 && filter === "all" ? "Nothing to change here." : "No findings at this level."}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((f) => (
                <FindingItem
                  key={f.id}
                  f={f}
                  active={f.id === activeId}
                  onSelect={() => {
                    setActiveId(f.id);
                    if (f.line) goToLine(f.line);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
        {hasCode && (
          <div ref={codeRef} className="lg:sticky lg:top-6 lg:self-start">
            <div className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b px-4 py-2.5 t-small muted" style={{ borderColor: "var(--rule)" }}>
                <span className="mono truncate">{report.title}</span>
                <span className="shrink-0 pl-3">{active?.line ? `Line ${active.line}` : "Click a highlighted line"}</span>
              </div>
              <CodeView content={report.content!} findings={report.findings} activeLine={active?.line ?? null} onLineClick={selectLine} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
