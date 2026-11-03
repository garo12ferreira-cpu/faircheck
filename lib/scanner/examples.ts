// Sample inputs for the "Try an example" buttons (and the tests).

export const EXAMPLE_CODE = `// candidate-screening.ts
import { db } from "./db";

type Gender = "male" | "female";

interface Candidate {
  firstName: string;
  lastName: string;
  gender: Gender;
  age: number;
  zipCode: string;
  yearsExperience: number;
  isMale: boolean;
}

const NAME_PATTERN = /^[A-Za-z]+$/;

export function validateCandidate(c: Candidate) {
  if (!NAME_PATTERN.test(c.firstName)) throw new Error("Invalid first name");
  if (c.lastName.length < 2) throw new Error("Last name too short");
}

export function screenCandidate(c: Candidate): number {
  let score = c.yearsExperience * 10;

  // sanity check: experience can't be negative
  if (score < 0) score = 0;

  if (c.age > 45) score -= 20; // candidate likely to retire soon
  if (c.gender === "female" && c.yearsExperience < 3) score -= 5;
  if (BLACKLISTED_ZIPS.includes(c.zipCode)) score -= 15;

  return score;
}

const BLACKLISTED_ZIPS = ["60621", "60636"];

// Send the shortlist to the hiring manager so he can review it
export async function shortlist() {
  const all = await db.candidates.findMany();
  return all.filter((c) => screenCandidate(c) > 50);
}
`;

export const EXAMPLE_PYTHON = `import pandas as pd
from sklearn.linear_model import LogisticRegression

df = pd.read_csv("loans.csv")
features = ["income", "credit_history", "age", "gender", "zip_code"]
X = df[features]
y = df["approved"]

model = LogisticRegression().fit(X, y)
`;

export const EXAMPLE_TEXT = `Welcome back, guys! 👋

Sign up
  Title: [Mr] [Mrs] [Ms]
  First name (required)
  Last name (required)
  Gender: ( ) Male  ( ) Female

Settings → Security → IP whitelist
Add an address to the whitelist to let it in, or blacklist it to block it.

Help centre
"Each user can export their data. When the user clicks Export, he gets a ZIP file."
"Our support team is available to handle crazy edge cases 24/7."
"Accounts created before 2024 are grandfathered into the old plan."
`;

/** Deterministic pseudo-random generator so the example dataset is always the same. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A hiring dataset where women and over-55s are hired less often. */
export function exampleCsv(rows = 600): string {
  const rand = mulberry32(42);
  const lines = ["applicant_id,gender,age,zip_code,years_experience,degree,hired"];
  const genders = ["Female", "Male", "Male", "Female", "Male", "Non-binary"];
  const zips = ["60621", "60614", "60657", "60636", "60611"];
  for (let i = 1; i <= rows; i++) {
    const r = rand();
    const gender = r < 0.03 ? "Non-binary" : genders[Math.floor(rand() * 5)];
    const age = 21 + Math.floor(rand() * 44);
    const exp = Math.max(0, Math.min(age - 21, Math.floor(rand() * 20)));
    const degree = rand() < 0.6 ? "yes" : "no";
    let p = 0.25 + exp * 0.015 + (degree === "yes" ? 0.1 : 0);
    if (gender === "Female") p -= 0.15;
    if (age >= 55) p -= 0.12;
    const hired = rand() < p ? 1 : 0;
    const zip = zips[Math.floor(rand() * zips.length)];
    lines.push([`A${1000 + i}`, rand() < 0.04 ? "" : gender, age, zip, exp, degree, hired].join(","));
  }
  return lines.join("\n");
}
