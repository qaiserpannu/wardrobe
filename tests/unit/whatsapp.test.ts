import { describe, expect, it } from "vitest";
import {
  buildProductInquiryLink,
  buildWhatsAppLink,
  isWhatsAppConfigured,
  normalizeWhatsAppNumber,
} from "@/integrations/whatsapp";

const config = {
  number: "15555550100",
  productMessage: "Hi! I'm interested in {name} (ID: {code}). Is it still available?",
};
const product = { name: "Black Midi Wrap Dress", code: "PLW-0001" };

describe("WhatsApp links", () => {
  it("normalises numbers to digits only", () => {
    expect(normalizeWhatsAppNumber("+1 (555) 555-0100")).toBe("15555550100");
    expect(normalizeWhatsAppNumber("0044 7700 900123")).toBe("447700900123");
  });

  it("treats empty or implausible numbers as not configured", () => {
    expect(isWhatsAppConfigured("")).toBe(false);
    expect(isWhatsAppConfigured("123")).toBe(false);
    expect(buildWhatsAppLink("", "hello")).toBeNull();
    expect(buildProductInquiryLink({ ...config, number: "" }, product)).toBeNull();
  });

  it("builds an official wa.me link with an encoded message", () => {
    expect(buildWhatsAppLink("15555550100", "Hi there & hello")).toBe(
      "https://wa.me/15555550100?text=Hi%20there%20%26%20hello",
    );
  });

  it("includes the product name, ID and page link in a product inquiry", () => {
    const link = buildProductInquiryLink(config, product, "https://example.com/shop/x")!;
    const text = new URL(link).searchParams.get("text")!;
    expect(link.startsWith("https://wa.me/15555550100?text=")).toBe(true);
    expect(text).toContain("Black Midi Wrap Dress");
    expect(text).toContain("PLW-0001");
    expect(text).toContain("https://example.com/shop/x");
  });

  it("still identifies the product if the message template lost its placeholders", () => {
    const link = buildProductInquiryLink({ ...config, productMessage: "Hello!" }, product)!;
    const text = new URL(link).searchParams.get("text")!;
    expect(text).toContain("PLW-0001");
    expect(text).toContain("Black Midi Wrap Dress");
  });
});
