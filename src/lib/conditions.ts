export const CONDITIONS = ["new_with_tags", "like_new", "good", "fair"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  new_with_tags: "New with tags",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

export const CONDITION_DESCRIPTIONS: Record<Condition, string> = {
  new_with_tags: "Never worn, original tags attached.",
  like_new: "Worn once or twice, no visible signs of wear.",
  good: "Gently worn, minor signs of wear.",
  fair: "Visible wear, priced accordingly.",
};
