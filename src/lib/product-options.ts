export const STITCHING = ["stitched", "unstitched"] as const;
export type Stitching = (typeof STITCHING)[number];
export const STITCHING_LABELS: Record<Stitching, string> = {
  stitched: "Stitched (ready to wear)",
  unstitched: "Unstitched (fabric)",
};

export const OCCASIONS = ["casual", "formal", "party", "festive", "wedding", "bridal"] as const;
export type Occasion = (typeof OCCASIONS)[number];
export const OCCASION_LABELS: Record<Occasion, string> = {
  casual: "Casual",
  formal: "Formal",
  party: "Party",
  festive: "Festive (Eid, Diwali)",
  wedding: "Wedding guest",
  bridal: "Bridal",
};

/** "3-piece", "2-piece"; a single item is shown as "1-piece". */
export function piecesLabel(pieces: number): string {
  return `${pieces}-piece`;
}
