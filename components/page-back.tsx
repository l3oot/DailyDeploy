import Link from "next/link";

export function PageBack({ href = "/home" }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Back"
      className="inline-flex h-12 w-12 items-center justify-center text-[#29292E]"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 19L8 12L15 5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}
