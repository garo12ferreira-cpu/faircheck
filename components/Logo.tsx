import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="FairCheck home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 2 4 7v8c0 7.5 5.1 13.4 12 15 6.9-1.6 12-7.5 12-15V7L16 2Z" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="2" />
        <path d="m11 16 3.5 3.5L21.5 12" fill="none" stroke="#60a5fa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-bold tracking-tight">
        Fair<span style={{ color: "var(--accent)" }}>Check</span>
      </span>
    </Link>
  );
}
