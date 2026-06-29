"use client";

import { useState, useEffect } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";

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
    try {
      const res = await fetch(`/api/history?userId=${user?.id}`);
      const data = await res.json();
      if (data.audits) setAudits(data.audits);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoadingHistory(false);
    }
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
            <span className="w-1.5 h-1.5 rounded-full"

