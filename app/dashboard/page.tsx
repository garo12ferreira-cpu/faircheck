"use client";

import { useState, useEffect } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { supabase } from "../../lib/supabase";

type Audit = {
  id: string;
  input_text: string;
  result: string;
  bias_score: string;
  created_at: string;
};

export default function Dashboard() {
  const { user } = useUser();
  const [inputText, setInputText] = useState("");
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<"analyse" | "history">("analyse");

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("audits")
      .select("*")
      .eq("user_id", user?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) setAudits(data);
    setLoadingHistory(false);
  };

  const handleAnalyse = async () => {
    if (!inputText.trim()) return;
    setIsAnalysing(true);
    setResult(null);

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText,
          userId: user?.id,
          userEmail: user?.primaryEmailAddress?.emailAddress,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setResult("Something went wrong. Please try again.");
      } else {
        setResult(data.result);
        fetchHistory();
      }
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

  const scoreColor = (score: string) => {
    if (score === "High") return { color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)" };
    if (score === "Medium") return { color: "#FBBF24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)" };
    return { color: "#10B981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" };
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
        .glow-blue { box-shadow: 0 0 20px rgba(59,130,246,0.4), 0 4px 16px rgba(0,0,0,0.4); }
        .glow-blue:hover { box-shadow: 0 0 28px rgba(59,130,246,0.6), 0 4px 24px rgba(0,0,0,0.5); }
        .glow-blue:disabled { box-shadow: none; opacity: 0.5; cursor: not-allowed; }
        textarea:focus { outline: none; border-color: rgba(59,130,246,0.5) !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .pulse-dot { animation: pulse-dot 1.2s ease-in-out infinite; }
        .pulse-dot-2 { animation: pulse-dot 1.2s ease-in-out 0.4s infinite; }
        .pulse-dot-3 { animation: pulse-dot 1.2s ease-in-out 0.8s infinite; }
      `}</style>

      {/* NAV */}
      <nav style={{ backgroundColor: "rgba(15,17,23,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
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
                style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#8B949E", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)"; (e.target as HTMLButtonElement).style.color = "#E6EDF3"; }}
                onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.target as HTMLButtonElement).style.color = "#8B949E"; }}
              >
                Sign Out
              </button>
            </SignOutButton>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#10B981" }} />
            Bias Audit Tool
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ letterSpacing: "-0.02em" }}>
            Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p style={{ color: "#6E7681" }}>Paste your AI&apos;s output and get a plain-English bias analysis in seconds.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mb-8" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { key: "analyse", label: "🔬 New Audit" },
            { key: "history", label: `📋 Audit History (${audits.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "analyse" | "history")}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #3B82F6" : "2px solid transparent",
                color: activeTab === tab.key ? "#E6EDF3" : "#6E7681",
                cursor: "pointer",
                paddingBottom: "12px",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ANALYSE TAB */}
        {activeTab === "analyse" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input */}
            <div>
              <div className="rounded-2xl p-6" style={{ backgroundColor: "#161B22", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.25)" }}>🔌</div>
                  <div>
                    <h2 className="font-semibold text-base" style={{ color: "#E6EDF3" }}>Paste AI Output</h2>
                    <p className="text-xs" style={{ color: "#6E7681" }}>Hiring decisions, chatbot responses, loan approvals</p>
                  </div>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={"Paste your AI's output here...\n\nExamples:\n• Hiring decision text\n• Chatbot responses\n• Loan approval reasoning\n• Any AI-generated decisions"}
                  rows={14}
                  style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px", color: "#E6EDF3", fontSize: "0.875rem", lineHeight: "1.6", resize: "vertical", transition: "border-color 0.2s, box-shadow 0.2s" }}
                />
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs" style={{ color: "#484F58" }}>{inputText.length} characters</span>
                  <button
                    onClick={handleAnalyse}
                    disabled={isAnalysing || !inputText.trim()}
                    className="glow-blue px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300"
                    style={{ backgroundColor: "#3B82F6", color: "#ffffff", cursor: inputText.trim() && !isAnalysing ? "pointer" : "not-allowed" }}
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
                    ) : "Analyse for Bias →"}
                  </button>
                </div>
              </div>
              <div className="rounded-2xl p-5 mt-4" style={{ backgroundColor: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.12)" }}>
                <p className="text-xs font-semibold mb-3" style={{ color: "#60A5FA" }}>HOW IT WORKS</p>
                {[{ icon: "1", text: "Paste any AI-generated text above" }, { icon: "2", text: "FairCheck scans across 5 bias dimensions" }, { icon: "3", text: "Receive a plain-English compliance report" }].map((step) => (
                  <div key={step.icon} className="flex items-start gap-3 mb-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ backgroundColor: "rgba(59,130,246,0.2)", color: "#60A5FA" }}>{step.icon}</span>
                    <span className="text-xs" style={{ color: "#8B949E" }}>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Results */}
            <div>
              <div className="rounded-2xl p-6 min-h-96" style={{ backgroundColor: "#161B22", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))", border: "1px solid rgba(16,185,129,0.25)" }}>📄</div>
                  <div>
                    <h2 className="font-semibold text-base" style={{ color: "#E6EDF3" }}>Bias Analysis Report</h2>
                    <p className="text-xs" style={{ color: "#6E7681" }}>Plain-English results for your compliance team</p>
                  </div>
                </div>
                {isAnalysing && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.25)" }}>🔬</div>
                    <div className="text-center">
                      <p className="font-medium mb-1" style={{ color: "#E6EDF3" }}>Analysing for bias...</p>
                      <p className="text-sm" style={{ color: "#6E7681" }}>Scanning across 5 bias dimensions</p>
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap justify-center">
                      {["Gender", "Race", "Age", "Disability", "Socioeconomic"].map((dim) => (
                        <span key={dim} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#60A5FA" }}>{dim}</span>
                      ))}
                    </div>
                  </div>
                )}
                {!isAnalysing && !result && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <span className="text-4xl">⚖️</span>
                    <p className="font-medium" style={{ color: "#484F58" }}>Your analysis will appear here</p>
                    <p className="text-sm" style={{ color: "#30363D" }}>Paste AI output on the left and click Analyse</p>
                  </div>
                )}
                {!isAnalysing && result && (
                  <div className="flex flex-col gap-4">
                    {parseResult(result).map((section) => (
                      <div key={section.label} className="rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: section.color }}>{section.label}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#C9D1D9" }}>{section.content}</p>
                      </div>
                    ))}
                    <button
                      onClick={() => { setResult(null); setInputText(""); }}
                      className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 mt-2"
                      style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#6E7681", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.target as HTMLButtonElement).style.color = "#E6EDF3"; }}
                      onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.target as HTMLButtonElement).style.color = "#6E7681"; }}
                    >
                      Run Another Audit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div>
            {loadingHistory && <div className="text-center py-16" style={{ color: "#6E7681" }}>Loading audit history...</div>}
            {!loadingHistory && audits.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <span className="text-4xl">📋</span>
                <p className="font-medium" style={{ color: "#484F58" }}>No audits yet</p>
                <p className="text-sm" style={{ color: "#30363D" }}>Run your first audit to see history here</p>
                <button onClick={() => setActiveTab("analyse")} className="mt-2 px-5 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)", color: "#60A5FA", cursor: "pointer" }}>
                  Run First Audit →
                </button>
              </div>
            )}
            {!loadingHistory && audits.length > 0 && (
              <div className="flex flex-col gap-4">
                {audits.map((audit) => {
                  const sc = scoreColor(audit.bias_score);
                  return (
                    <div key={audit.id} className="rounded-2xl p-6" style={{ backgroundColor: "#161B22", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex items-start justify-between mb-3 gap-4">
                        <p className="text-sm" style={{ color: "#8B949E", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {audit.input_text.slice(0, 100)}...
                        </p>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}>
                            {audit.bias_score} Risk
                          </span>
                          <span className="text-xs" style={{ color: "#484F58" }}>
                            {new Date(audit.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <details>
                        <summary className="text-xs cursor-pointer" style={{ color: "#60A5FA" }}>View full report</summary>
                        <div className="mt-4 flex flex-col gap-3">
                          {parseResult(audit.result).map((section) => (
                            <div key={section.label} className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <p className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: section.color }}>{section.label}</p>
                              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#C9D1D9" }}>{section.content}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

