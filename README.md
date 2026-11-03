# FairCheck

**Catch bias in your code before it ships.**

FairCheck is a bias checker for developers. Paste or drop in your work and it shows you, line by line, where it could treat people unfairly and how to fix each problem.

| What you scan | What it looks for |
|---|---|
| **Code** | Decisions that branch on gender, race, age, disability and other protected traits · proxies such as ZIP codes and graduation year · ML models trained on protected columns · gender stored as a boolean, binary-only gender options, gendered defaults · name validation that rejects accents, apostrophes and one-letter names |
| **UI text & names** | Forms with only Male/Female, Mr/Mrs-only titles, required surnames · non-inclusive wording in copy, docs, comments and identifiers (whitelist/blacklist, master/slave, sanity check, "the user… he", ableist slang) |
| **Datasets (CSV)** | Under-represented and dominant groups · outcome gaps measured with the four-fifths rule · missing demographic data · proxy columns · protected columns that would leak into training |

## How it works

1. **Rule engine** (`lib/scanner/`): fast, deterministic checks that run on every scan. They're pure TypeScript, with no network calls, and covered by tests.
2. **AI review** (`lib/ai-review.ts`): GPT-4o reads the same input with the rule hits attached. It adds problems the rules can't see, marks rule hits that are clearly harmless in context (e.g. a legal minimum-age check), and writes a short summary. Output is forced into a JSON schema. If the AI call fails, the scan still returns rule-based results.
3. **Report** (`components/ReportView.tsx`): risk level, findings with severity, line numbers, explanation and fix, an annotated code view, per-group charts for datasets, and a Markdown export for pull requests.

**Privacy:** CSV files are parsed in the browser. Only column names, group counts and outcome rates are sent to the server and the AI, never the rows themselves.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Sign-in (Clerk) |
| `OPENAI_API_KEY` | AI review (optional: without it you get rule-based results only) |
| `OPENAI_MODEL` | Optional, defaults to `gpt-4o` |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Saving scan history (optional) |

### Database

FairCheck reuses the existing `audits` table. The full report is stored as JSON in `result`, so no migration is needed. Older audits still show up in History as plain text. For a fresh project:

```sql
create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_email text,
  input_text text,
  result text,
  bias_score text,
  created_at timestamptz not null default now()
);
create index if not exists audits_user_created on audits (user_id, created_at desc);
alter table audits enable row level security;  -- only the server (service role) reads and writes
```

## Scripts

```bash
npm run dev     # local dev server
npm test        # rule engine + report tests
npm run lint
npm run build
```

## Project layout

```
app/
  page.tsx               landing page
  dashboard/page.tsx     scanner + history
  api/scan/route.ts      runs rules + AI review, saves the report
  api/history/route.ts   list / delete your scans
lib/
  scanner/               rule engine (code, language, dataset), examples
  ai-review.ts           OpenAI structured review
  build-report.ts        merges rules + AI into one report
  report-markdown.ts     Markdown export
components/              ReportView, DatasetCharts, Logo
proxy.ts                 Clerk auth (Next.js 16 renamed middleware.ts to proxy.ts)
tests/                   node:test suites, run with tsx
```

## Adding a rule

Code rules live in `lib/scanner/code-rules.ts`, wording rules in `lib/scanner/language-rules.ts`. Each rule returns a title, an explanation of the harm, and a concrete fix. Add a test in `tests/scanner.test.ts` for what it should catch **and** for lookalikes it should ignore.

---

FairCheck flags risks to review; it isn't legal advice. Built by Gabriel Ferreira.
