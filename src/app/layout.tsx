import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import { ChatWidgetLoader } from "@/components/chat/ChatWidgetLoader";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
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
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <ChatWidgetLoader />
      </body>
    </html>
  );
}
