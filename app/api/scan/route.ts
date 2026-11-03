import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { buildReport } from "@/lib/build-report";
import { detectLanguage, sanitizeProfile, type ScanMode } from "@/lib/scanner";
import { AUDITS_TABLE, supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

const MAX_CONTENT = 200_000;
const MODES: ScanMode[] = ["code", "text", "dataset"];

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Please sign in to run a scan." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const mode = body.mode as ScanMode;
  if (!MODES.includes(mode)) return NextResponse.json({ error: "Unknown scan mode." }, { status: 400 });

  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : undefined;
  let content: string | undefined;
  let dataset = undefined;

  if (mode === "dataset") {
    dataset = sanitizeProfile(body.dataset) ?? undefined;
    if (!dataset) return NextResponse.json({ error: "Missing dataset summary." }, { status: 400 });
  } else {
    content = typeof body.content === "string" ? body.content : "";
    if (!content.trim()) return NextResponse.json({ error: "Paste some code or text to scan." }, { status: 400 });
    if (content.length > MAX_CONTENT) {
      return NextResponse.json({ error: `That's too long. The limit is ${MAX_CONTENT.toLocaleString()} characters per scan.` }, { status: 413 });
    }
  }

  const title =
    fileName ||
    (mode === "code" ? "Pasted code" : mode === "text" ? "Pasted text" : dataset?.fileName || "Dataset");

  try {
    const report = await buildReport({
      mode,
      title,
      language: mode === "code" ? detectLanguage(fileName, content ?? "") : undefined,
      content,
      dataset,
    });

    let saved = false;
    const db = supabaseAdmin();
    if (db) {
      const user = await currentUser().catch(() => null);
      const preview =
        mode === "dataset"
          ? `Dataset: ${title} (${dataset!.rowCount.toLocaleString()} rows, ${dataset!.columns.length} columns)`
          : content!.slice(0, 500);
      const { error } = await db.from(AUDITS_TABLE).insert({
        user_id: userId,
        user_email: user?.primaryEmailAddress?.emailAddress ?? null,
        input_text: preview,
        result: JSON.stringify(report),
        bias_score: report.risk,
      });
      if (error) console.error("Supabase insert failed:", error.message);
      else saved = true;
    }

    return NextResponse.json({ report, saved });
  } catch (err) {
    console.error("Scan failed:", err);
    return NextResponse.json({ error: "Something went wrong while scanning. Please try again." }, { status: 500 });
  }
}
