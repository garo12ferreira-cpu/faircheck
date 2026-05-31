"use client";

import { useState } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";

export default function Dashboard() {
  const { user } = useUser();
  const [inputText, setInputText] = useState("");
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleAnalyse = async () => {
    if (!inputText.trim()) return;
    setIsAnalysing(true);
    setResult(null);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const data = await response.json();
      const text = data.content?.[0]?.text ?? "No result returned.";
      setResult(text);
    } catch {
      setResult("Something went wrong. Please try again.");
    } finally {
      setIsAnalysing(false);
    }
  };

  const parseResult = (text: string) => {
    const lines = text.split("\n");
    const sections: { label: string; content: string; color: string }[] = [];
    let currentLabel = "";
    let currentContent: string[] = [];

    const flush = () => {
      if (currentLabel && currentContent.length > 0) {
        const content = currentContent.join("\n").trim();
        let color = "#8B949E";
        if (currentLabel.includes("SCORE")) {
          if (content.includes("High")) color = "#F87171";
          else if (content.includes("Medium")) color = "#FBBF24";
          else color = "#10B981";
        }
        sections.push({ label: currentLabel, content, color });
      }
    };

    for (const line of lines) {
      if (
        line.startsWith("BIAS RISK SCORE") ||
        line.startsWith("DIMENSIONS FLAGGED") ||
        line.startsWith("SPECIFIC EXAMPLES") ||
        line.startsWith("REGULATORY RISK") ||
        line.startsWith("RECOMMENDATION")
      ) {
        flush();
        currentLabel = line.replace(":", "").trim();
        currentContent = [];
      } else if (line.trim()) {
        currentContent.push(line);
      }
    }
    flush();
    return sections;
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#0F1117",
        color: "#E6EDF3",
        fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif; }

        .glow-blue {
          box-shadow: 0 0 20px rgba(59,130,246,0.4), 0 4px 16px rgba(0,0,0,0.4);
        }
        .glow-blue:hover {
          box-shadow: 0 0 28px rgba(59,130,246,0.6), 0 4px 24px rgba(0,0,0,0.5);
        }
        .glow-blue:disabled {
          box-shadow: none;
          opacity: 0.5;
          cursor: not-allowed;
        }

        textarea:focus {
          outline: none;
          border-color: rgba(59,130,246,0.5) !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .pulse-dot { animation: pulse-dot 1.2s ease-in-out infinite; }
        .pulse-dot-2 { animation: pulse-dot 1.2s ease-in-out 0.4s infinite; }
        .pulse-dot-3 { animation: pulse-dot 1.2s ease-in-out 0.8s infinite; }
      `}</style>

      {/* ─── NAV ─── */}
      <nav
        style={{
          backgroundColor: "rgba(15,17,23,0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" style={{ textDecoration: "none" }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <span className="text-xl font-bold tracking-tight" style={{ color: "#E6EDF3" }}>
                Fair<span style={{ color: "#3B82F6" }}>Check</span>
              </span>
            </div>
          </a>

          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: "#6E7681" }}>
              {user?.firstName ? `Hi, ${user.firstName}` : "Dashboard"}
            </span>
            <SignOutButton>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#8B949E",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)";
                  (e.target as HTMLButtonElement).style.color = "#E6EDF3";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                  (e.target as HTMLButtonElement).style.color = "#8B949E";
                }}
              >
                Sign Out
              </button>
            </SignOutButton>
          </div>
        </div>
      </nav>

      {/* ─── MAIN ─── */}
      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)",
              color: "#10B981",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#10B981" }} />
            Bias Audit Tool
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ letterSpacing: "-0.02em" }}>
            Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p style={{ color: "#6E7681" }}>
            Paste your AI&apos;s output below and get a plain-English bias analysis in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ─── LEFT: Input ─── */}
          <div>
            <div
              className="rounded-2xl p-6"
              style={{
                backgroundColor: "#161B22",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{
                    background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))",
                    border: "1px solid rgba(59,130,246,0.25)",
                  }}
                >
                  🔌
                </div>
                <div>
                  <h2 className="font-semibold text-base" style={{ color: "#E6EDF3" }}>Paste AI Output</h2>
                  <p className="text-xs" style={{ color: "#6E7681" }}>Hiring decisions, chatbot responses, loan approvals</p>
                </div>
              </div>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Paste your AI's output here...\n\nExamples:\n• Hiring decision text\n• Chatbot responses\n• Loan approval reasoning\n• Any AI-generated decisions`}
                rows={14}
                style={{
                  width: "100%",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  padding: "14px",
                  color: "#E6EDF3",
                  fontSize: "0.875rem",
                  lineHeight: "1.6",
                  resize: "vertical",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              />

              <div className="flex items-center justify-between mt-4">
                <span className="text-xs" style={{ color: "#484F58" }}>
                  {inputText.length} characters
                </span>
                <button
                  onClick={handleAnalyse}
                  disabled={isAnalysing || !inputText.trim()}
                  className="glow-blue px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300"
                  style={{
                    backgroundColor: "#3B82F6",
                    color: "#ffffff",
                    cursor: inputText.trim() && !isAnalysing ? "pointer" : "not-allowed",
                  }}
                >
                  {isAnalysing ? (
                    <span className="flex items-center gap-2">
                      Analysing
                      <span className="flex gap-1">
                        <span className="pulse-dot w-1 h-1 rounded-full inline-block" style={{ backgroundColor: "#fff" }} />
                        <span className="pulse-dot-2 w-1 h-1 rounded-full inline-block" style={{ backgroundColor: "#fff" }} />
                        <span className="pulse-dot-3 w-1 h-1 rounded-full inline-block" style={{ backgroundColor: "#fff" }} />
                      </span>
                    </span>
                  ) : (
                    "Analyse for Bias →"
                  )}
                </button>
              </div>
            </div>

            {/* How it works */}
            <div
              className="rounded-2xl p-5 mt-4"
              style={{
                backgroundColor: "rgba(59,130,246,0.04)",
                border: "1px solid rgba(59,130,246,0.12)",
              }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: "#60A5FA" }}>HOW IT WORKS</p>
              <div className="flex flex-col gap-2">
                {[
                  { icon: "1", text: "Paste any AI-generated text above" },
                  { icon: "2", text: "FairCheck scans across 5 bias dimensions" },
                  { icon: "3", text: "Receive a plain-English compliance report" },
                ].map((step) => (
                  <div key={step.icon} className="flex items-start gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: "rgba(59,130,246,0.2)", color: "#60A5FA" }}
                    >
                      {step.icon}
                    </span>
                    <span className="text-xs" style={{ color: "#8B949E" }}>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Results ─── */}
          <div>
            <div
              className="rounded-2xl p-6 min-h-96"
              style={{
                backgroundColor: "#161B22",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{
                    background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
                    border: "1px solid rgba(16,185,129,0.25)",
                  }}
                >
                  📄
                </div>
                <div>
                  <h2 className="font-semibold text-base" style={{ color: "#E6EDF3" }}>Bias Analysis Report</h2>
                  <p className="text-xs" style={{ color: "#6E7681" }}>Plain-English results for your compliance team</p>
                </div>
              </div>

              {/* Loading state */}
              {isAnalysing && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))",
                      border: "1px solid rgba(59,130,246,0.25)",
                    }}
                  >
                    🔬
                  </div>
                  <div className="text-center">
                    <p className="font-medium mb-1" style={{ color: "#E6EDF3" }}>Analysing for bias...</p>
                    <p className="text-sm" style={{ color: "#6E7681" }}>Scanning across 5 bias dimensions</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {["Gender", "Race", "Age", "Disability", "Socioeconomic"].map((dim, i) => (
                      <span
                        key={dim}
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: "rgba(59,130,246,0.1)",
                          border: "1px solid rgba(59,130,246,0.2)",
                          color: "#60A5FA",
                          animationDelay: `${i * 0.15}s`,
                        }}
                      >
                        {dim}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!isAnalysing && !result && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <span className="text-4xl">⚖️</span>
                  <p className="font-medium" style={{ color: "#484F58" }}>Your analysis will appear here</p>
                  <p className="text-sm" style={{ color: "#30363D" }}>
                    Paste AI output on the left and click Analyse
                  </p>
                </div>
              )}

              {/* Results */}
              {!isAnalysing && result && (
                <div className="flex flex-col gap-4">
                  {parseResult(result).map((section) => (
                    <div
                      key={section.label}
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <p
                        className="text-xs font-semibold mb-2 uppercase tracking-wider"
                        style={{ color: section.color }}
                      >
                        {section.label}
                      </p>
                      <p
                        className="text-sm leading-relaxed whitespace-pre-line"
                        style={{ color: "#C9D1D9" }}
                      >
                        {section.content}
                      </p>
                    </div>
                  ))}

                  <button
                    onClick={() => { setResult(null); setInputText(""); }}
                    className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 mt-2"
                    style={{
                      backgroundColor: "transparent",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#6E7681",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
                      (e.target as HTMLButtonElement).style.color = "#E6EDF3";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
                      (e.target as HTMLButtonElement).style.color = "#6E7681";
                    }}
                  >
                    Run Another Audit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


