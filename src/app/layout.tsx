import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import { siteUrl } from "@/lib/site-url";
import { getCachedSettings } from "@/server/services/cached";
import "./globals.css";

const body = Geist({ variable: "--font-body", subsets: ["latin"] });
const display = Cormorant_Garamond({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { branding, seo } = await getCachedSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${branding.siteName} | ${branding.tagline}`, template: `%s | ${branding.siteName}` },
    description: seo.description,
    openGraph: { siteName: branding.siteName, type: "website" },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
