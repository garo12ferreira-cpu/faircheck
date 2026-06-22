import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { inputText, userId, userEmail } = await req.json();

    if (!inputText?.trim()) {
      return NextResponse.json({ error: "No input text provided" }, { status: 400 });
    }

    // Call Anthropic API from the server (keeps API key secret)
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are FairCheck, an AI bias auditing tool for compliance officers.
Analyse the provided AI output text for bias across these dimensions:
- Gender bias
- Racial or ethnic bias
- Age bias
- Disability bias
- Socioeconomic bias

Respond in this exact format:

BIAS RISK SCORE: [Low / Medium / High]

DIMENSIONS FLAGGED:
- [dimension]: [brief explanation, or "None detected"]

SPECIFIC EXAMPLES:
- [quote or pattern from the text that triggered a flag, or "No specific flags found"]

REGULATORY RISK:
[One sentence about potential regulatory implications, referencing EEOC, EU AI Act, or similar if relevant]

RECOMMENDATION:
[One to two sentences on what the compliance team should do next]

Be specific, factual, and non-alarmist. If no bias is detected, say so clearly.`,
        messages: [
          {
            role: "user",
            content: `Please analyse this AI output for bias:\n\n${inputText}`,
          },
        ],
      }),
    });

    const anthropicData = await anthropicRes.json();
    const resultText = anthropicData.content?.[0]?.text ?? "No result returned.";

    // Extract bias score for database
    const scoreMatch = resultText.match(/BIAS RISK SCORE:\s*(Low|Medium|High)/i);
    const biasScore = scoreMatch ? scoreMatch[1] : "Unknown";

    // Save to Supabase
    const { error: dbError } = await supabase.from("audits").insert({
      user_id: userId ?? "anonymous",
      user_email: userEmail ?? null,
      input_text: inputText,
      result: resultText,
      bias_score: biasScore,
    });

    if (dbError) {
      console.error("Supabase error:", dbError);
      // Still return the result even if saving fails
    }

    return NextResponse.json({ result: resultText, biasScore });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}


