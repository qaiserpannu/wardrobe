import type { MetadataRoute } from "next";
import { io } from "next/cache";
import { siteUrl } from "@/lib/site-url";
import { listSitemapProducts } from "@/server/services/products";

/** The pages search engines should know about: the shop and every item that can be bought right now. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await io();
  const base = siteUrl();
  const items = await listSitemapProducts();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...items.map((item) => ({
      url: `${base}/shop/${item.slug}`,
      lastModified: item.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
