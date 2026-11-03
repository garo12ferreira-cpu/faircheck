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
        <p className="font-bold">{title}</p>
        <p className="t-small muted">{caption}</p>
      </figcaption>
      <table className="w-full border-collapse t-small">
        <tbody>
          {groups.map((g) => {
            const v = value(g);
            const below = threshold !== undefined && v !== undefined && v < threshold;
            return (
              <tr key={g.group} title={`${g.group}: ${v === undefined ? "not enough data" : pct(v)}, ${g.count.toLocaleString()} rows`}>
                <th scope="row" className="w-[8.5rem] max-w-[8.5rem] truncate py-1.5 pr-3 text-left font-normal soft">
                  {g.group}
                </th>
                <td className="py-1.5">
                  <div className="relative h-3 rounded-r" style={{ background: "var(--series-track)" }}>
                    {v !== undefined && (
                      <div
                        className="h-full"
                        style={{ width: `${Math.max(1, (v / (max || 1)) * 100)}%`, background: "var(--series)", borderRadius: "0 4px 4px 0" }}
                      />
                    )}
                    {threshold !== undefined && (
                      <div
                        className="absolute -bottom-1 -top-1 border-l-2 border-dotted"
                        style={{ left: `${(threshold / (max || 1)) * 100}%`, borderColor: "var(--ink)" }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </td>
                <td className="mono w-[6.5rem] py-1.5 pl-3 text-right whitespace-nowrap">
                  {v === undefined ? "n/a" : pct(v)}
                  {below && <span className="sev-medium font-sans font-bold"> below</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
          <section key={s.column} className="panel p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="t-h3">
                By <span className="mono text-[0.9em]">{s.column}</span>
                {s.kind === "age-buckets" && <span className="t-small font-normal muted"> (grouped into age bands)</span>}
              </h3>
              {di !== undefined && (
                <p className={`sev ${di < 0.8 ? "sev-high" : di < 0.9 ? "sev-medium" : "sev-good"}`}>
                  {di < 0.8 ? "Fails" : di < 0.9 ? "Close to failing" : "Passes"} the four-fifths rule (ratio {di.toFixed(2)})
                </p>
              )}
            </div>
            <div className={`grid gap-8 ${dataset.target ? "md:grid-cols-2" : ""}`}>
              <BarList
                title="Share of rows"
                caption={`${(dataset.rowCount - s.missing).toLocaleString()} rows have a value${s.missing ? `, ${s.missing.toLocaleString()} are blank` : ""}.`}
                groups={s.groups}
                value={(g) => g.share}
                max={Math.max(...s.groups.map((g) => g.share))}
              />
              {dataset.target && (
                <BarList
                  title={`How often ${dataset.target.column} is ${dataset.target.positiveValue}`}
                  caption="The dotted line is 80% of the best-off group's rate. Groups below it fail the four-fifths rule."
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
