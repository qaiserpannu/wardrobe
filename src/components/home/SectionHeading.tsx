import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Ornament } from "@/components/ui/Ornament";

type Props = { eyebrow?: string; title: string; href?: string; linkLabel?: string; id?: string };

export function SectionHeading({ eyebrow, title, href, linkLabel, id }: Props) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-accent uppercase">{eyebrow}</p>}
        <h2 id={id} className="font-display text-3xl leading-tight font-medium sm:text-4xl">
          {title}
        </h2>
        <Ornament className="mt-3" />
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="hidden shrink-0 items-center gap-2 text-sm text-accent underline-offset-4 hover:underline sm:inline-flex"
        >
          {linkLabel} <ArrowRightIcon />
        </Link>
      )}
    </div>
  );
}
