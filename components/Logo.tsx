import Link from "next/link";

/** Wordmark: the name with a highlighter stroke under "Check". */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="text-[1.2rem] font-bold tracking-tight no-underline" aria-label="FairCheck home">
      Fair<span className="marker">Check</span>
    </Link>
  );
}
