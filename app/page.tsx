import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Logo } from "@/components/Logo";

type Line = { n: number; code: string; note?: { sev: "High" | "Medium"; title: string; body: string } };

const HERO_LINES: Line[] = [
  { n: 24, code: "export function screenCandidate(c: Candidate) {" },
  { n: 25, code: "  let score = c.yearsExperience * 10;" },
  { n: 26, code: "" },
  {
    n: 27,
    code: "  if (c.age > 45) score -= 20;",
    note: { sev: "High", title: "Lowers the score for older candidates", body: "That's age discrimination in hiring. Score on skills and experience instead." },
  },
  {
    n: 28,
    code: '  if (c.gender === "female") score -= 5;',
    note: { sev: "High", title: "Treats women differently", body: "Remove gender from the decision. Keep it only to audit results." },
  },
  {
    n: 29,
    code: "  if (badZips.has(c.zip)) score -= 15;",
    note: { sev: "Medium", title: "ZIP code can stand in for race", body: "Proxies like this recreate redlining. Drop it or show it's job-related." },
  },
  { n: 30, code: "" },
  { n: 31, code: "  return score;" },
  { n: 32, code: "}" },
];

const CHECKS = [
  {
    name: "Code",
    body: "Decisions that change because of someone's gender, race, age or disability. Stand-ins for those traits, like ZIP codes. Models trained on protected columns. Validation that rejects real names.",
    examples: ["if (age > 45)", "isMale: boolean", "/^[A-Za-z]+$/"],
  },
  {
    name: "Interface text and names",
    body: "Forms that offer only two genders or require a surname. Wording that leaves people out, in your copy, docs, comments and variable names.",
    examples: ["Mr / Mrs / Ms", "whitelist", "the user… he"],
  },
  {
    name: "Datasets",
    body: "Groups that barely appear in your data, outcomes that differ between groups by more than the four-fifths rule allows, and columns that act as proxies. The file is read in your browser; only totals are sent.",
    examples: ["hired rate by gender", "age bands", "zip_code"],
  },
];

const CASES = [
  {
    year: "2018",
    who: "Amazon",
    what: "A recruiting model learned to mark down CVs that contained the word “women's”. The company scrapped it.",
    check: "Models trained on protected traits",
  },
  {
    year: "2019",
    who: "Apple Card",
    what: "Women reported much lower credit limits than their husbands with similar finances, prompting a New York State investigation.",
    check: "Outcome gaps between groups",
  },
  {
    year: "2019",
    who: "US hospitals",
    what: "A widely used risk score treated past healthcare spending as a sign of need, and referred fewer Black patients for extra care.",
    check: "Proxy variables",
  },
];

function ReviewedCode() {
  return (
    <figure className="panel overflow-hidden" aria-label="Example: FairCheck's notes on a hiring function">
      <figcaption className="flex items-center justify-between border-b px-4 py-2.5 t-small muted" style={{ borderColor: "var(--rule)" }}>
        <span className="mono">candidate-screening.ts</span>
        <span>3 issues</span>
      </figcaption>
      <div className="py-3">
        {HERO_LINES.map((l) => (
          <div key={l.n} className="grid gap-x-5 md:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="code-line code-view min-w-0">
              <span className="ln">{l.n}</span>
              <code className="wrap-narrow">
                {l.note ? <span className="marker">{l.code.trimStart()}</span> : l.code || " "}
              </code>
            </div>
            {l.note && (
              <div className="mb-3 ml-12 mt-1 border-l-2 pl-3 md:mb-1 md:ml-0 md:mt-0.5 md:pr-4" style={{ borderColor: l.note.sev === "High" ? "var(--high)" : "var(--medium)" }}>
                <p className="t-small leading-snug">
                  <span className={`font-bold ${l.note.sev === "High" ? "sev-high" : "sev-medium"}`}>{l.note.sev}:</span>{" "}
                  <span className="font-bold">{l.note.title}.</span>{" "}
                  <span className="soft">{l.note.body}</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b" style={{ borderColor: "var(--rule)" }}>
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden sm:block"><a href="#how" className="btn btn-quiet">How it works</a></span>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button type="button" className="btn btn-quiet">Sign in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button" className="btn btn-primary btn-sm">Start a scan</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" className="btn btn-primary btn-sm">Dashboard</Link>
              <UserButton />
            </Show>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:pt-24">
          <div className="max-w-xl">
            <h1 className="t-display">Find the lines in your code that treat people unfairly.</h1>
            <p className="t-lead mt-6">
              FairCheck reads your code, interface text and training data the way a careful reviewer would. It points to the exact line,
              explains who could be harmed, and suggests what to change.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button type="button" className="btn btn-primary">Scan your code</button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link href="/dashboard" className="btn btn-primary">Scan your code</Link>
              </Show>
              <a href="#how" className="btn btn-secondary">How it works</a>
            </div>
          </div>
          <ReviewedCode />
        </section>

        {/* What it checks */}
        <section className="border-t" style={{ borderColor: "var(--rule)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="t-h2 max-w-2xl">Three places bias gets into software</h2>
            <p className="t-lead mt-3 max-w-2xl">Most of it isn&apos;t intentional. It arrives as a shortcut in the logic, a form field, or a dataset nobody checked.</p>
            <dl className="mt-12">
              {CHECKS.map((c) => (
                <div key={c.name} className="grid gap-3 border-t py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12" style={{ borderColor: "var(--rule)" }}>
                  <dt className="t-h3">{c.name}</dt>
                  <dd>
                    <p className="max-w-[62ch] soft">{c.body}</p>
                    <ul className="mt-4 flex flex-wrap gap-2" aria-label={`Examples for ${c.name}`}>
                      {c.examples.map((e) => (
                        <li key={e} className="mono rounded px-2 py-1 text-[0.8rem]" style={{ background: "var(--paper-2)", border: "1px solid var(--rule)" }}>
                          {e}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Real cases */}
        <section style={{ background: "var(--paper-2)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="t-h2 max-w-2xl">These started as ordinary lines of code</h2>
            <p className="t-lead mt-3 max-w-2xl">Each one was written, reviewed and shipped. Each matches a check FairCheck runs today.</p>
            <ul className="mt-12">
              {CASES.map((c) => (
                <li key={c.who} className="grid gap-2 border-t py-6 md:grid-cols-[6rem_minmax(0,1fr)_16rem] md:gap-8" style={{ borderColor: "var(--rule-strong)" }}>
                  <span className="mono t-small muted md:pt-0.5">{c.year}</span>
                  <p>
                    <span className="font-bold">{c.who}.</span> <span className="soft">{c.what}</span>
                  </p>
                  <p className="t-small muted md:pt-0.5">Caught by: {c.check}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-8">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="t-h2">How it works</h2>
            <ol className="mt-10 grid gap-10 md:grid-cols-3">
              <li>
                <p className="t-h3">1. Paste or upload</p>
                <p className="mt-2 soft">A file, a function, a sign-up form or a CSV. Nothing to install.</p>
              </li>
              <li>
                <p className="t-h3">2. Two reviewers read it</p>
                <p className="mt-2 soft">Fixed rules catch the known traps in seconds. Then an AI review reads for context, adds what the rules miss and clears false alarms.</p>
              </li>
              <li>
                <p className="t-h3">3. Fix it line by line</p>
                <p className="mt-2 soft">Each note names the line, explains the harm in plain words and suggests a change. Copy the report into your pull request.</p>
              </li>
            </ol>

            <div className="mt-16 flex flex-col items-start gap-5 border-t pt-10 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--rule)" }}>
              <p className="t-h3 max-w-xl">Make fairness part of code review, like tests and linting.</p>
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button type="button" className="btn btn-primary">Run your first scan</button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link href="/dashboard" className="btn btn-primary">Run a scan</Link>
              </Show>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 t-small muted sm:flex-row sm:justify-between">
          <p>FairCheck, built by Gabriel Ferreira.</p>
          <p>FairCheck points out risks. It isn&apos;t legal advice.</p>
        </div>
      </footer>
    </div>
  );
}
