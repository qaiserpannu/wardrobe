import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Search engines may read the shop, not the admin portal or the site's internal addresses. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    host: siteUrl(),
  };
}
