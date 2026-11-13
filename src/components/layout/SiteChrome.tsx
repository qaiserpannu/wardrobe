import type { ReactNode } from "react";
import { ChatWidgetLoader } from "@/components/chat/ChatWidgetLoader";
import { Footer } from "./Footer";
import { Header } from "./Header";

/** Header, footer and chat button around every public page (not the admin portal). */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
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
    </>
  );
}
