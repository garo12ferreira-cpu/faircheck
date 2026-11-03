"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";

import { Logo } from "@/components/Logo";
import { ReportView } from "@/components/ReportView";
import { buildProfile, inspectColumns, parseCsv, pickPositive, type ColumnSuggestions, type ParsedCsv } from "@/lib/scanner/dataset";
import { EXAMPLE_CODE, EXAMPLE_PYTHON, EXAMPLE_TEXT, exampleCsv } from "@/lib/scanner/examples";
import type { ScanMode, ScanReport } from "@/lib/scanner/types";

type Audit = { id: string; input_text: string; result: string; bias_score: string; created_at: string };

const MAX_CHARS = 200_000;
const MAX_CSV_BYTES = 50 * 1024 * 1024;

const MODES: { key: ScanMode; label: string; icon: string; blurb: string }[] = [
  { key: "code", label: "Code", icon: "</>", blurb: "Logic, validation, data models and ML pipelines" },
  { key: "text", label: "UI text & names", icon: "Aa", blurb: "Copy, forms, docs, comments and identifiers" },
  { key: "dataset", label: "Dataset (CSV)", icon: "▦", blurb: "Training or test data: representation and outcome gaps" },
];

function parseStored(a: Audit): ScanReport | null {
  try {
    const r = JSON.parse(a.result);
    return r && r.version === 2 ? (r as ScanReport) : null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const { user } = useUser();
  const [tab, setTab] = useState<"scan" | "history">("scan");
  const [mode, setMode] = useState<ScanMode>("code");

  // code / text input
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();

  // dataset input
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [csvName, setCsvName] = useState<string | undefined>();
  const [cols, setCols] = useState<ColumnSuggestions | null>(null);
  const [sensitive, setSensitive] = useState<string[]>([]);
  const [targetCol, setTargetCol] = useState<string>("");
  const [positive, setPositive] = useState<string>("");

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [dragging, setDragging] = useState(false);

  const [audits, setAudits] = useState<Audit[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "off" | "error">("loading");
  const [openId, setOpenId] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAudits(data.audits ?? []);
      setHistoryState(data.configured === false ? "off" : "ready");
    } catch {
      setHistoryState("error");
    }
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId) void loadHistory();
  }, [userId, loadHistory]);

  const loadCsv = (text: string, name?: string) => {
    const parsed = parseCsv(text);
    const info = inspectColumns(parsed);
    setCsv(parsed);
    setCsvName(name);
    setCols(info);
    setSensitive(info.sensitive);
    setTargetCol(info.target?.column ?? "");
    setPositive(info.target?.positiveValue ?? "");
    setReport(null);
    setError(parsed.headers.length < 2 ? "That doesn't look like a CSV with a header row." : null);
  };

  const readFile = async (file: File) => {
    setError(null);
    const isCsv = /\.(csv|tsv)$/i.test(file.name);
    if (isCsv || mode === "dataset") {
      if (file.size > MAX_CSV_BYTES) return setError("That file is over 50 MB. Try a sample of it.");
      setMode("dataset");
      loadCsv(await file.text(), file.name);
      return;
    }
    const text = await file.text();
    if (text.length > MAX_CHARS) return setError(`That file is over ${MAX_CHARS.toLocaleString()} characters. Scan one module at a time.`);
    if (/\u0000/.test(text.slice(0, 2000))) return setError("That looks like a binary file. Upload source code or text.");
    setContent(text);
    setFileName(file.name);
    setReport(null);
  };

  const loadExample = (kind: "ts" | "py" | "text" | "csv") => {
    setError(null);
    setReport(null);
    if (kind === "csv") {
      setMode("dataset");
      loadCsv(exampleCsv(), "hiring-sample.csv");
      return;
    }
    setMode(kind === "text" ? "text" : "code");
    setContent(kind === "ts" ? EXAMPLE_CODE : kind === "py" ? EXAMPLE_PYTHON : EXAMPLE_TEXT);
    setFileName(kind === "ts" ? "candidate-screening.ts" : kind === "py" ? "train_model.py" : "signup-and-settings.txt");
  };

  const binaryCols = useMemo(() => cols?.columns.filter((c) => c.binaryValues) ?? [], [cols]);
  const targetInfo = binaryCols.find((c) => c.name === targetCol);

  const canScan = !scanning && (mode === "dataset" ? Boolean(csv && csv.rows.length) : content.trim().length > 0);

  const runScan = async () => {
    if (!canScan) return;
    setScanning(true);
    setError(null);
    setReport(null);
    try {
      let body: Record<string, unknown>;
      if (mode === "dataset") {
        const profile = buildProfile(csv!, {
          fileName: csvName,
          sensitive,
          target: targetCol && positive ? { column: targetCol, positiveValue: positive } : undefined,
        });
        body = { mode, fileName: csvName, dataset: profile };
      } else {
        body = { mode, fileName, content };
      }
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setReport(data.report);
      if (data.saved) void loadHistory();
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setScanning(false);
    }
  };

  const removeAudit = async (id: string) => {
    const res = await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setAudits((a) => a.filter((x) => x.id !== id));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void readFile(file);
  };

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: "rgba(15,17,23,0.9)", borderBottom: "1px solid var(--border)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3.5 sm:gap-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1" role="tablist" aria-label="Dashboard sections">
            <button type="button" role="tab" aria-selected={tab === "scan"} className="tab" onClick={() => setTab("scan")}>
              New scan
            </button>
            <button type="button" role="tab" aria-selected={tab === "history"} className="tab" onClick={() => setTab("history")}>
              History {historyState === "ready" && <span style={{ color: "var(--text-3)" }}>({audits.length})</span>}
            </button>
          </div>
          <UserButton />
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {tab === "scan" && (
          <>
            <header className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">
                {user?.firstName ? `Hi ${user.firstName}, what` : "What"} are you shipping?
              </h1>
              <p className="mt-2 max-w-2xl" style={{ color: "var(--text-2)" }}>
                Paste or drop in your work. FairCheck finds the places where it could treat people unfairly and tells you how to fix each one.
              </p>
            </header>

            {/* Mode picker */}
            <div className="mb-5 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="What are you checking?">
              {MODES.map((m) => {
                const on = mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setMode(m.key);
                      setError(null);
                    }}
                    className="card flex items-start gap-3 p-4 text-left transition-colors"
                    style={{ borderColor: on ? "rgba(59,130,246,0.6)" : undefined, background: on ? "linear-gradient(135deg, var(--surface), rgba(59,130,246,0.08))" : undefined }}
                  >
                    <span
                      className="mono flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                      style={{ background: on ? "var(--accent-soft)" : "rgba(255,255,255,0.04)", color: on ? "#93c5fd" : "var(--text-3)", border: "1px solid var(--border)" }}
                    >
                      {m.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{m.label}</span>
                      <span className="block text-xs" style={{ color: "var(--text-3)" }}>{m.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Input */}
            <section
              className="card p-5"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              style={{ borderColor: dragging ? "rgba(59,130,246,0.7)" : undefined, borderStyle: dragging ? "dashed" : undefined }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
                  <span>Try an example:</span>
                  {mode === "code" && (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadExample("ts")}>Hiring logic (TS)</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadExample("py")}>Loan model (Python)</button>
                    </>
                  )}
                  {mode === "text" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadExample("text")}>Sign-up form & help text</button>}
                  {mode === "dataset" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadExample("csv")}>Hiring dataset</button>}
                </div>
                <div className="flex items-center gap-2">
                  {fileName && mode !== "dataset" && <span className="mono text-xs" style={{ color: "var(--text-2)" }}>{fileName}</span>}
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => fileInput.current?.click()}>
                    Upload file
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    className="hidden"
                    accept={mode === "dataset" ? ".csv,.tsv,.txt" : undefined}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void readFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>

              {mode !== "dataset" ? (
                <>
                  <textarea
                    className="field mono"
                    rows={16}
                    spellCheck={false}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      if (!e.target.value) setFileName(undefined);
                    }}
                    placeholder={
                      mode === "code"
                        ? "Paste a function, component, model or SQL query, or drop a file here.\n\nFairCheck looks for decisions based on gender, race, age and other protected traits, proxies like ZIP codes, forms that exclude real names and genders, and biased ML features."
                        : "Paste UI copy, form labels, docs, comments or a list of identifiers, or drop a file here.\n\nFairCheck looks for exclusionary wording, gendered defaults and forms that leave people out."
                    }
                    style={{ resize: "vertical", minHeight: 260 }}
                    aria-label={mode === "code" ? "Code to scan" : "Text to scan"}
                  />
                  <p className="mt-2 text-xs" style={{ color: content.length > MAX_CHARS ? "var(--high)" : "var(--text-3)" }}>
                    {content.split("\n").length.toLocaleString()} lines · {content.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
                  </p>
                </>
              ) : !csv ? (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl py-16 text-center"
                  style={{ border: "1px dashed var(--border-strong)", background: "rgba(255,255,255,0.02)" }}
                >
                  <span className="text-3xl" aria-hidden="true">▦</span>
                  <span className="font-medium">Drop a CSV here or click to choose one</span>
                  <span className="max-w-md text-xs" style={{ color: "var(--text-3)" }}>
                    The file is read in your browser. Only column totals and group rates are sent for the review, never the rows themselves.
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="mono">{csvName ?? "data.csv"}</span>
                      <span style={{ color: "var(--text-3)" }}>
                        {" "}· {csv.rows.length.toLocaleString()} rows · {csv.headers.length} columns{csv.truncated ? " (first 200,000 rows)" : ""}
                      </span>
                    </p>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setCsv(null);
                        setCols(null);
                        setReport(null);
                      }}
                    >
                      Choose another file
                    </button>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <fieldset>
                      <legend className="mb-1 text-sm font-semibold">Demographic columns to audit</legend>
                      <p className="mb-3 text-xs" style={{ color: "var(--text-3)" }}>We pre-selected the ones that look like protected traits. Adjust if needed.</p>
                      <div className="flex max-h-48 flex-wrap gap-2 overflow-auto">
                        {csv.headers.map((h) => {
                          const on = sensitive.includes(h);
                          return (
                            <label
                              key={h}
                              className="mono flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
                              style={{ border: `1px solid ${on ? "rgba(59,130,246,0.6)" : "var(--border)"}`, background: on ? "var(--accent-soft)" : "transparent" }}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={h === targetCol}
                                onChange={() => setSensitive((s) => (on ? s.filter((x) => x !== h) : [...s, h]))}
                                className="accent-blue-500"
                              />
                              {h}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="mb-1 text-sm font-semibold">Outcome column</legend>
                      <p className="mb-3 text-xs" style={{ color: "var(--text-3)" }}>
                        A yes/no result (hired, approved, label). FairCheck compares how often each group gets the good outcome.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <select
                          className="field mono"
                          style={{ width: "auto", minWidth: 180 }}
                          value={targetCol}
                          aria-label="Outcome column"
                          onChange={(e) => {
                            const name = e.target.value;
                            setTargetCol(name);
                            setSensitive((s) => s.filter((x) => x !== name));
                            const c = binaryCols.find((x) => x.name === name);
                            setPositive(c?.binaryValues ? pickPositive(c.binaryValues) : "");
                          }}
                        >
                          <option value="">No outcome column</option>
                          {binaryCols.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                        {targetInfo?.binaryValues && (
                          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-2)" }}>
                            Good outcome =
                            <select className="field mono" style={{ width: "auto" }} value={positive} onChange={(e) => setPositive(e.target.value)}>
                              {targetInfo.binaryValues.map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                      {binaryCols.length === 0 && (
                        <p className="mt-2 text-xs" style={{ color: "var(--text-3)" }}>No yes/no columns found, so only representation will be checked.</p>
                      )}
                    </fieldset>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  Rule checks run instantly; an AI reviewer then adds context-aware findings and filters out false alarms.
                </p>
                <button type="button" className="btn btn-primary" onClick={runScan} disabled={!canScan}>
                  {scanning ? (
                    <>
                      Scanning<span className="pulse-dot">…</span>
                    </>
                  ) : (
                    "Scan for bias →"
                  )}
                </button>
              </div>
            </section>

            {error && (
              <p role="alert" className="mt-4 rounded-xl px-4 py-3 text-sm sev-high" style={{ border: "1px solid rgba(248,113,113,0.3)" }}>
                {error}
              </p>
            )}

            <div ref={resultsRef} className="scroll-mt-24 pt-8">
              {scanning && (
                <div className="card flex flex-col items-center gap-2 py-14 text-center">
                  <p className="font-medium">Reviewing your {mode === "dataset" ? "data" : mode === "code" ? "code" : "text"}…</p>
                  <p className="text-sm" style={{ color: "var(--text-3)" }}>Rules first, then the AI reviewer. This usually takes 5–20 seconds.</p>
                </div>
              )}
              {report && <ReportView report={report} />}
            </div>
          </>
        )}

        {tab === "history" && (
          <section>
            <h1 className="mb-6 text-3xl font-bold tracking-tight">Scan history</h1>
            {historyState === "loading" && <p style={{ color: "var(--text-3)" }}>Loading…</p>}
            {historyState === "error" && <p className="sev-high rounded-xl px-4 py-3 text-sm">Couldn&apos;t load your history.</p>}
            {historyState === "off" && (
              <p style={{ color: "var(--text-3)" }}>History isn&apos;t set up yet: add your Supabase keys to save scans.</p>
            )}
            {historyState === "ready" && audits.length === 0 && (
              <div className="card flex flex-col items-center gap-3 py-16 text-center">
                <p className="font-medium">No scans yet</p>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => setTab("scan")}>Run your first scan →</button>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {audits.map((a) => {
                const r = parseStored(a);
                const open = openId === a.id;
                const risk = r?.risk ?? a.bias_score;
                const cls = risk === "High" ? "sev-high" : risk === "Medium" ? "sev-medium" : risk === "Low" ? "sev-good" : "sev-info";
                return (
                  <div key={a.id} className="card">
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      <span className={`pill ${cls}`}>{risk} risk</span>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? null : a.id)} aria-expanded={open}>
                        <span className="mono block truncate text-sm">{r?.title ?? a.input_text.slice(0, 80)}</span>
                        <span className="block text-xs" style={{ color: "var(--text-3)" }}>
                          {r ? `${{ code: "Code", text: "UI text & names", dataset: "Dataset" }[r.mode]} · ${r.counts.high} high, ${r.counts.medium} medium, ${r.counts.low} low · ` : "Legacy audit · "}
                          {new Date(a.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenId(open ? null : a.id)}>
                        {open ? "Hide" : "View"}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeAudit(a.id)} aria-label="Delete this scan">
                        Delete
                      </button>
                    </div>
                    {open && (
                      <div className="p-4 pt-0">
                        {r ? (
                          <ReportView report={r} />
                        ) : (
                          <pre className="whitespace-pre-wrap rounded-xl p-4 text-sm" style={{ background: "rgba(0,0,0,0.25)", color: "var(--text-2)" }}>
                            {a.result}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
