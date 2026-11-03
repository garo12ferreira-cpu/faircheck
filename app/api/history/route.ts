import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { AUDITS_TABLE, supabaseAdmin } from "@/lib/supabase";

// The user id always comes from the signed-in session, never from the URL,
// so nobody can read or delete someone else's scans.

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ audits: [], configured: false });

  const { data, error } = await db
    .from(AUDITS_TABLE)
    .select("id, input_text, result, bias_score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Supabase select failed:", error.message);
    return NextResponse.json({ error: "Couldn't load your history." }, { status: 500 });
  }
  return NextResponse.json({ audits: data ?? [], configured: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "History isn't configured." }, { status: 503 });

  const { error } = await db.from(AUDITS_TABLE).delete().eq("id", id).eq("user_id", userId);
  if (error) {
    console.error("Supabase delete failed:", error.message);
    return NextResponse.json({ error: "Couldn't delete that scan." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
