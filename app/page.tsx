import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Logo } from "@/components/Logo";

const CHECKS = [
  {
    icon: "</>",
    title: "Code",
    body: "Decisions that branch on gender, race, age or disability. Proxies like ZIP codes. ML pipelines trained on protected traits. Name validation that rejects José and O'Brien.",
    tags: ["TypeScript", "Python", "SQL", "Java", "Go", "+ more"],
  },
  {
    icon: "Aa",
    title: "UI text & names",
    body: "Forms with only two genders, required surnames, Mr/Mrs-only titles. Wording like whitelist, master/slave, sanity check or “the user… he” in copy, docs and identifiers.",
    tags: ["Forms", "Copy", "Docs", "Comments"],
  },
  {
    icon: "▦",
    title: "Datasets",
    body: "Groups that are barely represented, outcome gaps that fail the four-fifths rule, missing demographic data and proxy columns, before you train on them.",
    tags: ["CSV", "Training data", "Labels"],
  },
];

const INCIDENTS = [
  {
    who: "Amazon · 2018",
    what: "A recruiting model learned to downgrade CVs containing the word “women's”. It was a training-data problem, and it was scrapped.",
    rule: "ML training features",
  },
  {
    who: "Apple Card · 2019",
    what: "Women reported far lower credit limits than their husbands with similar finances, which triggered a New York State investigation.",
    rule: "Outcome disparity",
  },
  {
    who: "Healthcare algorithm · 2019",
    what: "A risk score used past spending as a proxy for medical need and under-referred Black patients for extra care (Science, 2019).",
    rule: "Proxy variable",
  },
];

const STEPS = [
  { n: "01", title: "Paste or drop it in", body: "A file, a function, a form, a CSV. No setup, no SDK, no data-science background." },
  { n: "02", title: "Rules + AI review", body: "Fast pattern checks catch the known traps. An AI reviewer then reads for context, adds what rules miss and clears false alarms." },
  { n: "03", title: "Fix it line by line", body: "Every finding points to the exact line, explains the harm in plain English and gives you the fix. Export it as Markdown for your PR." },
];

function CodePreview() {
  const lines: { n: number; code: string; hit?: "high" | "medium" | "low" }[] = [
    { n: 27, code: "let score = c.yearsExperience * 10;" },
    { n: 28, code: "" },
    { n: 29, code: "if (c.age > 45) score -= 20;", hit: "high" },
    { n: 30, code: 'if (c.gender === "female") score -= 5;', hit: "high" },
    { n: 31, code: "if (BLACKLISTED_ZIPS.includes(c.zip)) score -= 15;", hit: "high" },
    { n: 32, code: "" },
    { n: 33, code: "return score;" },
  ];
  return (
    <div className="card overflow-hidden text-left shadow-2xl" style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.15)" }}>
      <div className="flex items-center gap-2 px-4 py-2.5 text-xs" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)" }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3a3f47" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3a3f47" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3a3f47" }} />
        <span className="mono ml-2">candidate-screening.ts</span>
      </div>
      <div className="code-view mono py-3">
        {lines.map((l) => (
          <div key={l.n} className={`code-line ${l.hit ? `hit-${l.hit}` : ""}`}>
            <span className="ln">{l.n}</span>
            <code>{l.code || " "}</code>
          </div>
        ))}
      </div>
      <div className="m-3 mt-0 rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="pill sev-high">✕ High</span>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>Protected attribute in logic · Line 29</span>
        </div>
        <p className="text-sm font-semibold">Decision branches on age</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
          This lowers a candidate&apos;s score because of their age, which is age discrimination in hiring (e.g. US ADEA, UK Equality Act).
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--good)" }}>
          Fix: score on job-relevant factors only, and keep age out of decision code.
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: "rgba(15,17,23,0.8)", borderBottom: "1px solid var(--border)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Logo />
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button type="button" className="btn btn-ghost btn-sm">Sign in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button" className="btn btn-soft btn-sm">Get started free</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" className="btn btn-soft btn-sm">Open dashboard →</Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="grid-bg relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(59,130,246,0.1), transparent 70%)" }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div>
            <span className="pill sev-good mb-6">For developers & ML engineers</span>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Catch bias in your code <span className="gradient-text">before it ships.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed" style={{ color: "var(--text-2)" }}>
              FairCheck reviews your code, UI text and training data the way a fairness expert would, then shows you exactly which lines could
              treat people unfairly and how to fix them.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button type="button" className="btn btn-primary" style={{ padding: "14px 26px", fontSize: "1rem" }}>
                    Scan your code free →
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link href="/dashboard" className="btn btn-primary" style={{ padding: "14px 26px", fontSize: "1rem" }}>
                  Start a scan →
                </Link>
              </Show>
              <a href="#how" className="text-sm hover:underline" style={{ color: "var(--text-2)" }}>
                See how it works
              </a>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: "var(--text-3)" }}>
              {["Line-by-line fixes", "Any language", "CSV rows stay in your browser"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span style={{ color: "var(--good)" }}>✓</span> {t}
                </li>
              ))}
            </ul>
          </div>
          <CodePreview />
        </div>
      </section>

      {/* What it checks */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Three places bias hides in software</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center" style={{ color: "var(--text-2)" }}>
          Most bias isn&apos;t intentional. It slips in through a shortcut in the logic, a form field, or a dataset nobody checked.
        </p>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {CHECKS.map((c) => (
            <div key={c.title} className="card flex flex-col p-6 transition-transform hover:-translate-y-1">
              <span
                className="mono mb-5 flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold"
                style={{ background: "var(--accent-soft)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" }}
              >
                {c.icon}
              </span>
              <h3 className="text-xl font-bold">{c.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{c.body}</p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <span key={t} className="pill">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="py-24" style={{ background: "linear-gradient(180deg, transparent, rgba(59,130,246,0.04), transparent)" }}>
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Every one of these <span style={{ color: "var(--high)" }}>started as code</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center" style={{ color: "var(--text-2)" }}>
            Each was written by a developer, reviewed and shipped. Each maps to a check FairCheck runs.
          </p>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {INCIDENTS.map((i) => (
              <div key={i.who} className="card flex flex-col p-6">
                <p className="mono text-xs" style={{ color: "var(--text-3)" }}>{i.who}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed" style={{ color: "var(--text)" }}>{i.what}</p>
                <p className="mt-5 text-xs" style={{ color: "var(--text-3)" }}>
                  Would be flagged by: <span style={{ color: "#93c5fd" }}>{i.rule}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <p className="mono text-3xl font-bold" style={{ color: "rgba(59,130,246,0.35)" }}>{s.n}</p>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{s.body}</p>
            </div>
          ))}
        </div>
        <div className="card mt-14 flex flex-col items-center gap-5 p-10 text-center" style={{ background: "linear-gradient(135deg, var(--surface), rgba(59,130,246,0.07))" }}>
          <h3 className="text-2xl font-bold">Make fairness part of code review.</h3>
          <p className="max-w-xl" style={{ color: "var(--text-2)" }}>
            It takes less time than a lint run, and costs far less than a regulator&apos;s letter.
          </p>
          <Show when="signed-out">
            <SignUpButton mode="modal">
              <button type="button" className="btn btn-primary">Scan your first file →</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" className="btn btn-primary">Start a scan →</Link>
          </Show>
        </div>
      </section>

      <footer className="px-6 py-10" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm sm:flex-row" style={{ color: "var(--text-3)" }}>
          <Logo />
          <p>Built by Gabriel Ferreira</p>
          <p className="text-xs">FairCheck flags risks; it isn&apos;t legal advice.</p>
        </div>
      </footer>
    </div>
  );
}
