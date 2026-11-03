import { test } from "node:test";
import assert from "node:assert/strict";

import { buildReport } from "../lib/build-report";

const CODE = `function eligible(user) {
  if (user.age >= 18) return true; // legal minimum age
  if (user.country !== "US") return false;
  return false;
}`;

test("merges the AI review: dismisses false positives and adds new findings", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const realFetch = globalThis.fetch;
  let sentBody: { messages: { content: string }[]; response_format: { type: string } } | undefined;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sentBody = JSON.parse(String(init.body));
    const content = JSON.stringify({
      summary: "Low risk overall. Check the country restriction.",
      findings: [
        {
          line: 3, category: "Proxy variable", severity: "medium", title: "Country used to deny eligibility",
          explanation: "Excludes everyone outside the US.", suggestion: "Gate on the legal requirement instead.",
        },
        { line: 999, category: "Not a category", severity: "low", title: "Bad line", explanation: "x", suggestion: "y" },
      ],
      rule_reviews: [{ id: "r1", verdict: "false_positive", note: "Legal minimum age check." }],
    });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  }) as typeof fetch;

  try {
    const r = await buildReport({ mode: "code", title: "eligibility.js", content: CODE });
    assert.equal(sentBody?.response_format.type, "json_schema");
    assert.match(sentBody!.messages[1].content, /2 \| +if \(user\.age >= 18\)/);
    assert.equal(r.aiReviewed, true);
    assert.equal(r.summary, "Low risk overall. Check the country restriction.");

    const ageRule = r.findings.find((f) => f.ruleId === "protected-attribute-in-logic");
    assert.equal(ageRule?.severity, "info");
    assert.equal(ageRule?.aiNote, "Legal minimum age check.");

    const added = r.findings.find((f) => f.title === "Country used to deny eligibility");
    assert.equal(added?.source, "ai");
    assert.equal(added?.line, 3);
    assert.equal(added?.snippet, 'if (user.country !== "US") return false;');

    const bad = r.findings.find((f) => f.title === "Bad line");
    assert.equal(bad?.line, undefined, "out-of-range line numbers are dropped");
    assert.equal(bad?.category, "Other");

    assert.equal(r.risk, "Medium");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test("falls back to rules only when the AI call fails", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const realFetch = globalThis.fetch;
  const realError = console.error;
  console.error = () => {};
  globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
  try {
    const r = await buildReport({ mode: "code", title: "x.js", content: CODE });
    assert.equal(r.aiReviewed, false);
    assert.match(r.summary, /AI review unavailable/);
    assert.ok(r.findings.some((f) => f.ruleId === "protected-attribute-in-logic" && f.severity !== "info"));
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    delete process.env.OPENAI_API_KEY;
  }
});
