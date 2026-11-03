import { test } from "node:test";
import assert from "node:assert/strict";

import { riskLevel, runRules, sanitizeProfile } from "../lib/scanner/index";
import { buildProfile, inspectColumns, parseCsv } from "../lib/scanner/dataset";
import { EXAMPLE_CODE, EXAMPLE_PYTHON, EXAMPLE_TEXT, exampleCsv } from "../lib/scanner/examples";

const ids = (content: string, mode: "code" | "text" = "code") =>
  runRules(mode, { content }).map((f) => f.ruleId);

test("flags decisions based on protected traits", () => {
  assert.ok(ids(`if (applicant.gender === "female") score -= 10;`).includes("protected-attribute-in-logic"));
  assert.ok(ids(`if age > 50 and hiring: reject(candidate)`).includes("protected-attribute-in-logic"));
  const [f] = runRules("code", { content: `if (c.age > 45) score -= 20;` });
  assert.equal(f.severity, "high");
});

test("flags proxies and protected model features", () => {
  assert.ok(ids(`if (BLOCKED_ZIPS.includes(user.zipCode)) deny()`).includes("proxy-in-logic"));
  assert.ok(ids(EXAMPLE_PYTHON).includes("protected-feature-in-model"));
  assert.ok(ids(`features = ["income", "zip_code"]`).includes("proxy-feature-in-model"));
  assert.ok(!ids(`X = df.drop(columns=["gender", "race"])`).includes("protected-feature-in-model"));
});

test("flags gender, name and title assumptions", () => {
  const all = ids(EXAMPLE_CODE);
  for (const id of ["binary-gender-options", "gender-boolean", "ascii-only-names", "name-min-length"]) {
    assert.ok(all.includes(id), `expected ${id}`);
  }
  assert.ok(ids(`gender: "male",`).includes("gender-default"));
  assert.ok(!ids(`const GENDERS = ["female", "male", "non-binary", "prefer-not-to-say"];`).includes("binary-gender-options"));
  assert.ok(ids(`<select name="title"><option>Mr</option><option>Mrs</option><option>Ms</option></select>`).includes("title-without-mx"));
  assert.ok(!ids(`titles = ["Mr", "Mrs", "Ms", "Mx"]`).includes("title-without-mx"));
  assert.ok(!ids(`const NAME = /^[\\p{L}\\p{M}' .-]+$/u; // name`).includes("ascii-only-names"));
});

test("flags non-inclusive wording in identifiers and text", () => {
  assert.ok(ids(`const ipWhitelist = new Set();`).includes("language-whitelist-blacklist"));
  assert.ok(ids(`replicate(masterNode, slaveNodes)`).includes("language-master-slave"));
  assert.ok(!ids(`replicate(masterNode, slaveNodes)`).includes("language-master"));
  const text = ids(EXAMPLE_TEXT, "text");
  for (const id of ["language-guys", "title-without-mx", "last-name-required", "binary-gender-options", "language-he-for-user"]) {
    assert.ok(text.includes(id), `expected ${id}`);
  }
});

test("ignores ordinary code that only looks similar", () => {
  const clean = `
res.cookie("sid", token, { maxAge: 3600, httpOnly: true });
if (cache.age > maxAge) refresh();
// avoid a race condition when two workers write at once
if (raceCondition) retry();
const fileName = file.name.replace(/[a-z]+/g, "");
if (page > 1 && pageSize < 50) load();
element.className = "btn";
if (user.name.length > 100) throw new Error("too long");
git checkout main
const mastercard = detectCard(number);
if (message.includes("sex")) moderate(); // moderation keyword list
`;
  const found = runRules("code", { content: clean });
  const unexpected = found.filter((f) => f.ruleId !== "protected-attribute-in-logic" || !/moderate/.test(f.snippet ?? ""));
  assert.deepEqual(unexpected.map((f) => `${f.ruleId}@${f.line}`), []);
});

test("parses quoted CSV fields", () => {
  const p = parseCsv(`name,comment,hired\n"Smith, J","said ""hi""\nthen left",1\nLee,ok,0\n`);
  assert.deepEqual(p.headers, ["name", "comment", "hired"]);
  assert.equal(p.rows.length, 2);
  assert.equal(p.rows[0][0], "Smith, J");
  assert.equal(p.rows[0][1], 'said "hi"\nthen left');
});

test("finds representation and outcome gaps in a dataset", () => {
  const parsed = parseCsv(exampleCsv());
  const s = inspectColumns(parsed);
  assert.deepEqual(s.sensitive.sort(), ["age", "gender"]);
  assert.deepEqual(s.target, { column: "hired", positiveValue: "1" });
  const profile = buildProfile(parsed, { sensitive: s.sensitive, target: s.target });
  const findings = runRules("dataset", { dataset: profile });
  const rules = findings.map((f) => f.ruleId);
  assert.ok(rules.includes("dataset-disparate-impact"));
  assert.ok(rules.includes("dataset-proxy-columns"));
  assert.equal(riskLevel(findings), "High");
});

test("a balanced dataset passes the four-fifths rule", () => {
  const rows = ["gender,approved"];
  for (let i = 0; i < 400; i++) rows.push(`${i % 2 ? "Woman" : "Man"},${i % 4 < 2 ? "yes" : "no"}`);
  const parsed = parseCsv(rows.join("\n"));
  const s = inspectColumns(parsed);
  const profile = buildProfile(parsed, { sensitive: s.sensitive, target: s.target });
  assert.ok((profile.sensitive[0].disparateImpact ?? 0) > 0.95);
  assert.ok(!runRules("dataset", { dataset: profile }).some((f) => f.ruleId === "dataset-disparate-impact"));
});

test("sanitizeProfile drops junk and recomputes the ratio server-side", () => {
  const p = sanitizeProfile({
    rowCount: 100,
    columns: [{ name: "x".repeat(500), type: "numeric", missing: -5 }],
    target: { column: "hired", positiveValue: "1", positiveRate: 7 },
    sensitive: [{ column: "gender", groups: [
      { group: "A", count: 50, share: 0.5, positiveRate: 0.6 },
      { group: "B", count: 50, share: 0.5, positiveRate: 0.3 },
    ], disparateImpact: 1 }],
    evil: "<script>",
  });
  assert.ok(p);
  assert.equal(p.columns[0].name.length, 200);
  assert.equal(p.columns[0].missing, 0);
  assert.equal(p.target?.positiveRate, 1);
  assert.equal(p.sensitive[0].disparateImpact, 0.5);
  assert.equal(sanitizeProfile("nope"), null);
});
