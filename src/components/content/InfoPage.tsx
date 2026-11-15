import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Ornament } from "@/components/ui/Ornament";

/** Layout shared by the plain information pages (how buying works, privacy). */
export function InfoPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-medium sm:text-5xl">{title}</h1>
        <Ornament className="mt-4" />
      </header>
      <div className="max-w-2xl space-y-8 text-base leading-relaxed [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_li]:mt-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </Container>
  );
}
