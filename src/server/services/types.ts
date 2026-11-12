import type { Condition } from "@/lib/conditions";
import type { Occasion, Stitching } from "@/lib/product-options";

export type PublicImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
};

/**
 * A product as the public may see it. Only "available" and "sold" items are
 * ever returned in this shape; drafts and archived items stay internal.
 */
export type PublicProduct = {
  code: string;
  slug: string;
  name: string;
  description: string;
  category: { name: string; slug: string };
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
  status: "available" | "sold";
  isFeatured: boolean;
  publishedAt: Date | null;
  images: PublicImage[];
};

export type PublicCategory = {
  name: string;
  slug: string;
  availableCount: number;
};

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
