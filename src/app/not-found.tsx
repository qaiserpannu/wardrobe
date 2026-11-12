import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { NotFoundMessage } from "@/components/ui/NotFoundMessage";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <Container>
      <NotFoundMessage />
    </Container>
  );
}
