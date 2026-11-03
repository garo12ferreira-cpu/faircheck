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

const MODES: { key: ScanMode; label: string; blurb: string }[] = [
  { key: "code", label: "Code", blurb: "Logic, validation, data models and ML pipelines." },
  { key: "text", label: "Text and names", blurb: "Interface copy, form fields, docs, comments and variable names." },
  { key: "dataset", label: "Dataset", blurb: "A CSV of training or test data. It's read in your browser; only totals are sent."  },
];

const MODE_NAME: Record<ScanMode, string> = { code: "Code", text: "Interface text", dataset: "Dataset" };

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

  const currentMode = MODES.find((m) => m.key === mode)!;

  return (
    <div className="min-h-screen">
      <header className="border-b" style={{ borderColor: "var(--rule)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <div className="segmented" role="tablist" aria-label="Dashboard sections">
            <button type="button" role="tab" aria-selected={tab === "scan"} onClick={() => setTab("scan")}>
              New scan
            </button>
            <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>
              History{historyState === "ready" ? ` (${audits.length})` : ""}
            </button>
          </div>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {tab === "scan" && (
          <>
            <h1 className="t-h2">{user?.firstName ? `What are you checking today, ${user.firstName}?` : "What are you checking today?"}</h1>

            <div className="mt-6">
              <div className="segmented max-w-full flex-nowrap overflow-x-auto" role="radiogroup" aria-label="What to check">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.key}
                    onClick={() => {
                      setMode(m.key);
                      setError(null);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 t-small muted">{currentMode.blurb}</p>
            </div>

            {/* Input */}
            <section
              className="panel mt-6 p-4 sm:p-5"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              style={dragging ? { borderColor: "var(--link)", borderStyle: "dashed", background: "var(--paper-2)" } : undefined}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 t-small">
                  <span className="muted mr-1">Load an example:</span>
                  {mode === "code" && (
                    <>
                      <button type="button" className="btn btn-quiet btn-sm text-link" onClick={() => loadExample("ts")}>hiring logic in TypeScript</button>
                      <button type="button" className="btn btn-quiet btn-sm text-link" onClick={() => loadExample("py")}>loan model in Python</button>
                    </>
                  )}
                  {mode === "text" && (
                    <button type="button" className="btn btn-quiet btn-sm text-link" onClick={() => loadExample("text")}>sign-up form and help text</button>
                  )}
                  {mode === "dataset" && (
                    <button type="button" className="btn btn-quiet btn-sm text-link" onClick={() => loadExample("csv")}>hiring dataset</button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {fileName && mode !== "dataset" && <span className="mono t-small muted">{fileName}</span>}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()}>
                    Upload a file
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
                        ? "Paste a function, component, model or SQL query here, or drop a file onto this box."
                        : "Paste interface copy, form labels, docs, comments or a list of variable names here, or drop a file onto this box."
                    }
                    style={{ resize: "vertical", minHeight: 280 }}
                    aria-label={mode === "code" ? "Code to check" : "Text to check"}
                  />
                  <p className="mt-2 t-small" style={{ color: content.length > MAX_CHARS ? "var(--high)" : "var(--ink-3)" }}>
                    {content ? `${content.split("\n").length.toLocaleString()} lines, ` : ""}
                    {content.length.toLocaleString()} of {MAX_CHARS.toLocaleString()} characters
                  </p>
                </>
              ) : !csv ? (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-1 rounded-md px-6 py-16 text-center"
                  style={{ border: "1px dashed var(--rule-strong)", background: "var(--paper-2)" }}
                >
                  <span className="font-bold">Choose a CSV file, or drop one here</span>
                  <span className="max-w-md t-small muted">
                    It stays in your browser. FairCheck only sends column names, group counts and outcome rates for the review.
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      <span className="mono font-bold">{csvName ?? "data.csv"}</span>{" "}
                      <span className="muted">
                        has {csv.rows.length.toLocaleString()} rows and {csv.headers.length} columns{csv.truncated ? " (first 200,000 rows read)" : ""}.
                      </span>
                    </p>
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => {
                        setCsv(null);
                        setCols(null);
                        setReport(null);
                      }}
                    >
                      Choose another file
                    </button>
                  </div>

                  <div className="grid gap-8 md:grid-cols-2">
                    <fieldset>
                      <legend className="font-bold">Which columns describe people&apos;s demographics?</legend>
                      <p className="mb-3 t-small muted">We ticked the ones that look like protected traits. Change them if needed.</p>
                      <div className="flex max-h-48 flex-wrap gap-2 overflow-auto">
                        {csv.headers.map((h) => {
                          const on = sensitive.includes(h);
                          return (
                            <label
                              key={h}
                              className="mono flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-[0.8rem]"
                              style={{ border: `1px solid ${on ? "var(--ink)" : "var(--rule-strong)"}`, background: on ? "var(--paper-2)" : "var(--paper)" }}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={h === targetCol}
                                onChange={() => setSensitive((s) => (on ? s.filter((x) => x !== h) : [...s, h]))}
                                style={{ accentColor: "var(--ink)" }}
                              />
                              {h}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="font-bold">Which column is the outcome?</legend>
                      <p className="mb-3 t-small muted">A yes/no result such as hired, approved or label. FairCheck compares how often each group gets the good result.</p>
                      <div className="flex flex-wrap items-center gap-3">
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
                          <label className="flex items-center gap-2 t-small soft">
                            Good result is
                            <select className="field mono" style={{ width: "auto" }} value={positive} onChange={(e) => setPositive(e.target.value)}>
                              {targetInfo.binaryValues.map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                      {binaryCols.length === 0 && (
                        <p className="mt-2 t-small muted">There are no yes/no columns, so FairCheck will only check how well each group is represented.</p>
                      )}
                    </fieldset>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--rule)" }}>
                <p className="t-small muted">Rules run first, then an AI review adds context and clears false alarms.</p>
                <button type="button" className="btn btn-primary" onClick={runScan} disabled={!canScan}>
                  {scanning ? "Checking…" : "Check for bias"}
                </button>
              </div>
            </section>

            {error && (
              <p role="alert" className="mt-4 rounded px-4 py-3" style={{ background: "var(--high-bg)", color: "var(--high)" }}>
                {error}
              </p>
            )}

            <div ref={resultsRef} className="scroll-mt-6 pt-12" aria-live="polite">
              {scanning && (
                <p className="soft">
                  Checking your {mode === "dataset" ? "data" : mode === "code" ? "code" : "text"}. This usually takes 5 to 20 seconds.
                </p>
              )}
              {report && <ReportView report={report} />}
            </div>
          </>
        )}

        {tab === "history" && (
          <section>
            <h1 className="t-h2">Your past scans</h1>
            <div className="mt-6">
              {historyState === "loading" && <p className="soft">Loading your scans…</p>}
              {historyState === "error" && <p style={{ color: "var(--high)" }}>Your scans couldn&apos;t be loaded. Refresh the page to try again.</p>}
              {historyState === "off" && <p className="soft">Scan history isn&apos;t set up. Add your Supabase keys to save scans.</p>}
              {historyState === "ready" && audits.length === 0 && (
                <div className="py-10">
                  <p className="soft">You haven&apos;t run any scans yet.</p>
                  <button type="button" className="btn btn-primary mt-4" onClick={() => setTab("scan")}>Run your first scan</button>
                </div>
              )}
              <ul className="border-t" style={{ borderColor: audits.length ? "var(--rule)" : "transparent" }}>
                {audits.map((a) => {
                  const r = parseStored(a);
                  const open = openId === a.id;
                  const risk = r?.risk ?? a.bias_score;
                  const cls = risk === "High" ? "sev-high" : risk === "Medium" ? "sev-medium" : risk === "Low" ? "sev-good" : "sev-info";
                  const when = new Date(a.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                  return (
                    <li key={a.id} className="border-b" style={{ borderColor: "var(--rule)" }}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4">
                        <span className={`sev ${cls} w-28 shrink-0`}>{risk} risk</span>
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? null : a.id)} aria-expanded={open}>
                          <span className="mono block truncate">{r?.title ?? a.input_text.slice(0, 80)}</span>
                          <span className="block t-small muted">
                            {r
                              ? `${MODE_NAME[r.mode]}, ${r.counts.high} high, ${r.counts.medium} medium, ${r.counts.low} low. ${when}`
                              : `Older audit. ${when}`}
                          </span>
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenId(open ? null : a.id)}>
                          {open ? "Hide report" : "View report"}
                        </button>
                        <button type="button" className="btn btn-quiet btn-sm" onClick={() => removeAudit(a.id)}>
                          Delete
                        </button>
                      </div>
                      {open && (
                        <div className="pb-8">
                          {r ? (
                            <ReportView report={r} />
                          ) : (
                            <pre className="whitespace-pre-wrap rounded p-4 t-small" style={{ background: "var(--paper-2)" }}>
                              {a.result}
                            </pre>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
