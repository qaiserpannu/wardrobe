import type { Metadata } from "next";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Container } from "@/components/ui/Container";
import { NotFoundMessage } from "@/components/ui/NotFoundMessage";

export const metadata: Metadata = { title: "Page not found" };

/** Addresses that match no page at all. (Missing products use the one inside the site layout.) */
export default function NotFound() {
  return (
    <SiteChrome>
      <Container>
        <NotFoundMessage />
      </Container>
    </SiteChrome>
  );
}
