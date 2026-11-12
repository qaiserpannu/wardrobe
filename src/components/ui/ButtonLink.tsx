import Link from "next/link";
import type { ReactNode } from "react";

const VARIANTS = {
  primary: "bg-ink text-white hover:bg-accent-dark",
  outline: "border border-ink text-ink hover:bg-ink hover:text-white",
  whatsapp: "bg-whatsapp text-white hover:bg-whatsapp-dark",
} as const;

type Props = {
  href: string;
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  /** Opens in a new tab with safe rel attributes. */
  external?: boolean;
  className?: string;
};

export function ButtonLink({ href, children, variant = "primary", external, className = "" }: Props) {
  const classes = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-medium tracking-wide transition-colors ${VARIANTS[variant]} ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
