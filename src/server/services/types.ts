import type { Condition } from "@/lib/conditions";
import type { Occasion, Stitching } from "@/lib/product-options";

export type PublicImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
};

/**
 * A product as the public may see it. Only "available", "pending" (on hold)
 * and "sold" items are ever returned in this shape; drafts and archived items
 * stay internal. Hold details (who, until when, notes) are never part of it.
 */
export type PublicProduct = {
  code: string;
  slug: string;
  name: string;
  description: string;
  category: { name: string; slug: string };
  /** The group the category sits in (Women, Men...), if any. */
  group: { name: string; slug: string } | null;
  brand: string | null;
  size: string | null;
  color: string | null;
  fabric: string | null;
  pieces: number | null;
  stitching: Stitching | null;
  occasion: Occasion | null;
  /** Seller's notes on flaws. Null means nothing has been recorded - not that there are none. */
  imperfections: string | null;
  condition: Condition;
  priceCents: number;
  status: "available" | "pending" | "sold";
  isFeatured: boolean;
  publishedAt: Date | null;
  images: PublicImage[];
};

export type PublicCategory = {
  name: string;
  slug: string;
  /** Items currently available. For a group this includes everything inside it. */
  availableCount: number;
};

/** A top-level category with the categories inside it. A group with no children is just a plain category. */
export type PublicCategoryGroup = PublicCategory & { children: PublicCategory[] };

export type ProductListResult = {
  items: PublicProduct[];
  total: number;
  page: number;
  pageCount: number;
};

export type CatalogFacets = {
  sizes: string[];
  brands: string[];
  fabrics: string[];
  pieces: number[];
  minPriceCents: number | null;
  maxPriceCents: number | null;
};
