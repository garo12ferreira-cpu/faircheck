"use client";

import type { DatasetProfile, GroupStat } from "@/lib/scanner/types";

const pct = (x: number) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`;

function BarList({
  title,
  caption,
  groups,
  value,
  max,
  threshold,
}: {
  title: string;
  caption: string;
  groups: GroupStat[];
  value: (g: GroupStat) => number | undefined;
  max: number;
  threshold?: number;
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs" style={{ color: "var(--text-3)" }}>{caption}</p>
      </figcaption>
      <div className="relative flex flex-col gap-2.5">
        {groups.map((g) => {
          const v = value(g);
          const below = threshold !== undefined && v !== undefined && v < threshold;
          return (
            <div
              key={g.group}
              className="group grid items-center gap-3 rounded-md px-1 py-0.5 hover:bg-white/[0.04]"
              style={{ gridTemplateColumns: "minmax(5rem, 9rem) 1fr 4.5rem" }}
              title={`${g.group}: ${v === undefined ? "not enough data" : pct(v)} · ${g.count.toLocaleString()} rows`}
            >
              <span className="truncate text-xs" style={{ color: "var(--text-2)" }}>{g.group}</span>
              <div className="relative h-2.5 rounded-r" style={{ background: "var(--series-track)" }}>
                {v !== undefined && (
                  <div
                    className="h-full rounded-r transition-[width] duration-500"
                    style={{ width: `${Math.max(1, (v / (max || 1)) * 100)}%`, background: "var(--series-1)", borderTopRightRadius: 4, borderBottomRightRadius: 4 }}
                  />
                )}
                {threshold !== undefined && (
                  <div
                    className="absolute -top-1 -bottom-1 w-0 border-l border-dashed"
                    style={{ left: `${(threshold / (max || 1)) * 100}%`, borderColor: "var(--text-2)" }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <span className="mono text-right text-xs" style={{ color: "var(--text)" }}>
                {v === undefined ? "n/a" : pct(v)}
                {below && (
                  <span className="ml-1" style={{ color: "var(--medium)" }} aria-label="below the four-fifths line">
                    ▼
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export function DatasetCharts({ dataset }: { dataset: DatasetProfile }) {
  if (dataset.sensitive.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {dataset.sensitive.map((s) => {
        const rates = s.groups.map((g) => g.positiveRate).filter((x): x is number => x !== undefined);
        const maxRate = rates.length ? Math.max(...rates) : 0;
        const di = s.disparateImpact;
        return (
          <section key={s.column} className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                <span className="mono text-sm" style={{ color: "var(--text-2)" }}>{s.column}</span>
                {s.kind === "age-buckets" && <span className="ml-2 text-xs" style={{ color: "var(--text-3)" }}>grouped into age bands</span>}
              </h3>
              {di !== undefined && (
                <span className={`pill ${di < 0.8 ? "sev-high" : di < 0.9 ? "sev-medium" : "sev-good"}`}>
                  {di < 0.8 ? "✕ Fails" : di < 0.9 ? "! Borderline" : "✓ Passes"} four-fifths rule · ratio {di.toFixed(2)}
                </span>
              )}
            </div>
            <div className={`grid gap-6 ${dataset.target ? "md:grid-cols-2" : ""}`}>
              <BarList
                title="Share of rows"
                caption={`${(dataset.rowCount - s.missing).toLocaleString()} rows with a value${s.missing ? `, ${s.missing.toLocaleString()} blank` : ""}`}
                groups={s.groups}
                value={(g) => g.share}
                max={Math.max(...s.groups.map((g) => g.share))}
              />
              {dataset.target && (
                <BarList
                  title={`Rate of ${dataset.target.column} = ${dataset.target.positiveValue}`}
                  caption="Dashed line = 80% of the best-off group's rate (the four-fifths rule)"
                  groups={s.groups}
                  value={(g) => g.positiveRate}
                  max={maxRate}
                  threshold={maxRate * 0.8}
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
