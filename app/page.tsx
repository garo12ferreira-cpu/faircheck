"use client";

import { useState, useEffect, useRef } from "react";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

export default function FairCheckLanding() {
  const [scrolled, setScrolled] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const { isSignedIn } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set([...prev, entry.target.id]));
          }
        });
      },
      { threshold: 0.15 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const setRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  const isVisible = (id: string) => visibleSections.has(id);

  const incidents = [
    {
      company: "Amazon",
      year: "2018",
      icon: "📦",
      headline: "AI Hiring Tool Scrapped",
      detail:
        "Amazon's ML recruiting engine systematically penalised female applicants — downgrading CVs that included words like 'women's'. The tool was quietly shelved after an internal audit.",
      tag: "Hiring Bias",
      tagColor: "text-red-400 bg-red-400/10 border border-red-400/20",
    },
    {
      company: "Apple Card / Goldman Sachs",
      year: "2019",
      icon: "💳",
      headline: "20× Credit Limit Disparity",
      detail:
        "Women with identical financial profiles to their male partners received credit limits up to 20× lower. A New York State investigation was triggered — no ML expertise saved them from regulatory scrutiny.",
      tag: "Lending Bias",
      tagColor: "text-amber-400 bg-amber-400/10 border border-amber-400/20",
    },
    {
      company: "HireVue",
      year: "2021",
      icon: "🎥",
      headline: "FTC Complaint, Feature Discontinued",
      detail:
        "Facial analysis feature flagged for potential disability and racial bias. Following an FTC complaint, HireVue discontinued the feature — a reputational hit no startup can afford.",
      tag: "Disability & Racial Bias",
      tagColor: "text-purple-400 bg-purple-400/10 border border-purple-400/20",
    },
  ];

  const steps = [
    {
      number: "01",
      icon: "🔌",
      title: "Connect",
      description:
        "Paste your AI's outputs directly into FairCheck, or connect your system via our simple REST API. No data science setup. No environment configuration.",
    },
    {
      number: "02",
      icon: "🔬",
      title: "Analyse",
      description:
        "FairCheck automatically scans for bias across 14 dimensions — including gender, race, age, and disability — in minutes. We do the ML so you don't have to.",
    },
    {
      number: "03",
      icon: "📄",
      title: "Report",
      description:
        "Download a plain-English compliance report your legal team, board, or regulator can actually read. No Python. No statistics. Just clear findings and recommended actions.",
    },
  ];

  return (
    <div
      className="min-h-screen font-sans antialiased"
      style={{
        backgroundColor: "#0F1117",
        color: "#E6EDF3",
        fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

        * { font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif; }
        .mono { font-family: 'DM Mono', monospace; }

        .glow-blue {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.15), 0 4px 16px rgba(0,0,0,0.4);
        }
        .glow-blue:hover {
          box-shadow: 0 0 28px rgba(59, 130, 246, 0.6), 0 0 56px rgba(59, 130, 246, 0.25), 0 4px 24px rgba(0,0,0,0.5);
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(59, 130, 246, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .fade-in-up {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s ease, transform 0.65s ease;
        }
        .fade-in-up.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .delay-100 { transition-delay: 0.1s; }
        .delay-200 { transition-delay: 0.2s; }
        .delay-300 { transition-delay: 0.3s; }
        .delay-400 { transition-delay: 0.4s; }

        .card-hover {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          border-color: rgba(59, 130, 246, 0.35) !important;
          box-shadow: 0 8px 32px rgba(59, 130, 246, 0.12);
        }

        .shine-text {
          background: linear-gradient(135deg, #E6EDF3 0%, #94A3B8 50%, #E6EDF3 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .blue-text {
          background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .noise-overlay {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E");
          pointer-events: none;
        }

        .pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .cl-userButtonAvatarBox {
          width: 36px !important;
          height: 36px !important;
        }
      `}</style>

      {/* ─── NAV BAR ─── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "rgba(15,17,23,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <span className="text-xl font-bold tracking-tight" style={{ color: "#E6EDF3" }}>
              Fair<span style={{ color: "#3B82F6" }}>Check</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!isSignedIn && (
              <>
                <SignInButton mode="modal">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{
                      backgroundColor: "transparent",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#8B949E",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)";
                      (e.target as HTMLButtonElement).style.color = "#E6EDF3";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                      (e.target as HTMLButtonElement).style.color = "#8B949E";
                    }}
                  >
                    Sign In
                  </button>
                </SignInButton>
                <SignInButton mode="modal">
                  <button
                    className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                    style={{
                      backgroundColor: "rgba(59,130,246,0.12)",
                      border: "1px solid rgba(59,130,246,0.35)",
                      color: "#60A5FA",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = "rgba(59,130,246,0.2)";
                      (e.target as HTMLButtonElement).style.borderColor = "rgba(59,130,246,0.6)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.backgroundColor = "rgba(59,130,246,0.12)";
                      (e.target as HTMLButtonElement).style.borderColor = "rgba(59,130,246,0.35)";
                    }}
                  >
                    Request Early Access
                  </button>
                </SignInButton>
              </>
            )}
            {isSignedIn && (
              <>
                <a
                  href="/dashboard"
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    backgroundColor: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.35)",
                    color: "#60A5FA",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLAnchorElement).style.backgroundColor = "rgba(59,130,246,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLAnchorElement).style.backgroundColor = "rgba(59,130,246,0.12)";
                  }}
                >
                  Go to Dashboard →
                </a>
                <UserButton afterSignOutUrl="/" />
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section
        id="hero"
        ref={setRef("hero")}
        className="relative min-h-screen flex items-center justify-center text-center overflow-hidden grid-bg"
      >
        <div className="noise-overlay" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.08) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-32 pb-24">
          <div className={`fade-in-up ${isVisible("hero") ? "visible" : ""} inline-flex items-center gap-2 mb-8`}>
            <span
              className="pill-badge"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.25)",
                color: "#10B981",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#10B981" }} />
              Now in Private Beta
            </span>
          </div>

          <h1
            className={`fade-in-up delay-100 ${isVisible("hero") ? "visible" : ""} text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6`}
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="shine-text">Know Your AI Is Clean</span>
            <br />
            <span className="blue-text">Before a Regulator Does</span>
          </h1>

          <p
            className={`fade-in-up delay-200 ${isVisible("hero") ? "visible" : ""} text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed`}
            style={{ color: "#8B949E" }}
          >
            FairCheck gives compliance officers a plain-English bias audit report in under 10 minutes —{" "}
            <span style={{ color: "#94A3B8" }}>no data scientists needed.</span>
          </p>

          <div className={`fade-in-up delay-300 ${isVisible("hero") ? "visible" : ""} flex flex-col items-center gap-4`}>
            {!isSignedIn && (
              <SignInButton mode="modal">
                <button
                  className="glow-blue px-8 py-4 rounded-xl text-base font-semibold transition-all duration-300"
                  style={{ backgroundColor: "#3B82F6", color: "#ffffff" }}
                  onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = "#2563EB"; }}
                  onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = "#3B82F6"; }}
                >
                  Run Your First Audit Free →
                </button>
              </SignInButton>
            )}
            {isSignedIn && (
              <a
                href="/dashboard"
                className="glow-blue px-8 py-4 rounded-xl text-base font-semibold transition-all duration-300"
                style={{ backgroundColor: "#3B82F6", color: "#ffffff", textDecoration: "none", display: "inline-block" }}
                onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.backgroundColor = "#2563EB"; }}
                onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.backgroundColor = "#3B82F6"; }}
              >
                Go to Your Dashboard →
              </a>
            )}
            <p className="text-sm" style={{ color: "#484F58" }}>No credit card. No engineers. No jargon.</p>
          </div>

          <div className={`fade-in-up delay-400 ${isVisible("hero") ? "visible" : ""} mt-16 flex flex-wrap justify-center gap-8`}>
            {["14 Bias Dimensions", "< 10 Min Reports", "Zero ML Expertise"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span style={{ color: "#10B981" }}>✓</span>
                <span className="text-sm" style={{ color: "#6E7681" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, #0F1117)" }}
        />
      </section>

      {/* ─── PROBLEM SECTION ─── */}
      <section id="problem" ref={setRef("problem")} className="py-24 px-6 max-w-6xl mx-auto">
        <div className={`fade-in-up ${isVisible("problem") ? "visible" : ""} text-center mb-4`}>
          <span
            className="pill-badge mb-4"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}
          >
            ⚠️ Real Consequences
          </span>
        </div>
        <h2
          className={`fade-in-up delay-100 ${isVisible("problem") ? "visible" : ""} text-3xl sm:text-4xl font-bold text-center mb-4`}
          style={{ letterSpacing: "-0.02em" }}
        >
          <span className="shine-text">Companies Have Already</span>{" "}
          <span style={{ color: "#F87171" }}>Paid the Price</span>
        </h2>
        <p
          className={`fade-in-up delay-200 ${isVisible("problem") ? "visible" : ""} text-center max-w-xl mx-auto mb-14`}
          style={{ color: "#6E7681" }}
        >
          These aren&apos;t hypotheticals. They&apos;re cautionary tales from companies that didn&apos;t catch bias before the regulators did.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {incidents.map((incident, i) => (
            <div
              key={incident.company}
              className={`fade-in-up delay-${(i + 1) * 100} ${isVisible("problem") ? "visible" : ""} card-hover rounded-2xl p-6 flex flex-col gap-4`}
              style={{ backgroundColor: "#161B22", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                  {incident.icon}
                </div>
                <span className="mono text-xs px-2 py-1 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#6E7681" }}>
                  {incident.year}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "#6E7681" }}>{incident.company}</p>
                <h3 className="text-lg font-bold mb-2" style={{ color: "#E6EDF3" }}>{incident.headline}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#8B949E" }}>{incident.detail}</p>
              </div>
              <div className="mt-auto pt-2">
                <span className={`pill-badge text-xs ${incident.tagColor}`}>{incident.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section
        id="how"
        ref={setRef("how")}
        className="py-24 px-6 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0F1117 0%, rgba(59,130,246,0.04) 50%, #0F1117 100%)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className={`fade-in-up ${isVisible("how") ? "visible" : ""} text-center mb-4`}>
            <span className="pill-badge mb-4" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#60A5FA" }}>
              🔄 The Process
            </span>
          </div>
          <h2
            className={`fade-in-up delay-100 ${isVisible("how") ? "visible" : ""} text-3xl sm:text-4xl font-bold text-center mb-4`}
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="shine-text">Three Steps.</span>{" "}
            <span className="blue-text">Zero ML Knowledge Required.</span>
          </h2>
          <p className={`fade-in-up delay-200 ${isVisible("how") ? "visible" : ""} text-center max-w-lg mx-auto mb-16`} style={{ color: "#6E7681" }}>
            We abstracted away every technical barrier so you can focus on what matters: keeping your company compliant.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((step, i) => (
              <div key={step.number} className={`fade-in-up delay-${(i + 1) * 100} ${isVisible("how") ? "visible" : ""} relative`}>
                {i < steps.length - 1 && (
                  <div
                    className="hidden md:block absolute top-7 left-full w-full h-px z-0"
                    style={{ background: "linear-gradient(90deg, rgba(59,130,246,0.3), rgba(59,130,246,0.05))", marginLeft: "16px", width: "calc(100% - 32px)" }}
                  />
                )}
                <div className="card-hover rounded-2xl p-8 h-full flex flex-col gap-5 relative z-10" style={{ backgroundColor: "#161B22", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.25)" }}
                    >
                      {step.icon}
                    </div>
                    <span className="mono text-4xl font-bold" style={{ color: "rgba(59,130,246,0.2)" }}>{step.number}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-3" style={{ color: "#E6EDF3" }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#8B949E" }}>{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHO IT HELPS ─── */}
      <section id="who" ref={setRef("who")} className="py-24 px-6 max-w-6xl mx-auto">
        <div className={`fade-in-up ${isVisible("who") ? "visible" : ""} text-center mb-4`}>
          <span className="pill-badge mb-4" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981" }}>
            👤 Who It&apos;s For
          </span>
        </div>
        <h2
          className={`fade-in-up delay-100 ${isVisible("who") ? "visible" : ""} text-3xl sm:text-4xl font-bold text-center mb-4`}
          style={{ letterSpacing: "-0.02em" }}
        >
          <span className="shine-text">Built for the People Who</span>
          <br />
          <span className="blue-text">Carry the Compliance Burden</span>
        </h2>
        <p className={`fade-in-up delay-200 ${isVisible("who") ? "visible" : ""} text-center max-w-lg mx-auto mb-14`} style={{ color: "#6E7681" }}>
          You&apos;re accountable if your AI discriminates — but you shouldn&apos;t need a PhD to prove it doesn&apos;t.
        </p>

        <div className="max-w-2xl mx-auto">
          <div
            className={`fade-in-up delay-300 ${isVisible("who") ? "visible" : ""} card-hover rounded-2xl p-8`}
            style={{ backgroundColor: "#161B22", border: "1px solid rgba(59,130,246,0.2)", background: "linear-gradient(135deg, #161B22 0%, rgba(59,130,246,0.04) 100%)" }}
          >
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(16,185,129,0.1))", border: "1px solid rgba(59,130,246,0.25)" }}
              >
                ⚖️
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="pill-badge" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#60A5FA" }}>Head of Product</span>
                  <span className="pill-badge" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#60A5FA" }}>Legal Counsel</span>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: "#6E7681" }}>Early-stage B2B startup · AI in hiring, lending, or customer service</p>
                <blockquote className="mt-4 text-base leading-relaxed italic" style={{ color: "#C9D1D9" }}>
                  &ldquo;I&apos;m responsible if our AI discriminates — but I can&apos;t read a Python notebook. I need something I can show to legal.&rdquo;
                </blockquote>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {["No in-house data scientists", "Regulators won't wait", "Board needs evidence", "Existing tools are unusable"].map((pain) => (
                    <div key={pain} className="flex items-center gap-2 text-sm" style={{ color: "#8B949E" }}>
                      <span style={{ color: "#10B981" }}>→</span>
                      {pain}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center gap-4 justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm" style={{ color: "#6E7681" }}>This is exactly who FairCheck was built for.</p>
              {!isSignedIn && (
                <SignInButton mode="modal">
                  <button
                    className="glow-blue px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap"
                    style={{ backgroundColor: "#3B82F6", color: "#ffffff" }}
                    onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = "#2563EB"; }}
                    onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = "#3B82F6"; }}
                  >
                    Run Your First Audit Free →
                  </button>
                </SignInButton>
              )}
              {isSignedIn && (
                <a
                  href="/dashboard"
                  className="glow-blue px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap"
                  style={{ backgroundColor: "#3B82F6", color: "#ffffff", textDecoration: "none", display: "inline-block" }}
                  onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.backgroundColor = "#2563EB"; }}
                  onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.backgroundColor = "#3B82F6"; }}
                >
                  Go to Your Dashboard →
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-12 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🛡️</span>
            <span className="text-lg font-bold" style={{ color: "#E6EDF3" }}>
              Fair<span style={{ color: "#3B82F6" }}>Check</span>
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: "#6E7681" }}>Built by Gabriel Ferreira</p>
          <p className="text-xs" style={{ color: "#484F58" }}>FairCheck — AI Bias Auditing for Teams Without Data Scientists</p>
          <div className="flex items-center gap-6 mt-2">
            {["Privacy", "Terms", "Contact"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-xs transition-colors duration-200"
                style={{ color: "#484F58" }}
                onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.color = "#60A5FA"; }}
                onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.color = "#484F58"; }}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

