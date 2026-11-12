"use client";

import { useEffect } from "react";
import { setChatProduct } from "./chat-product-store";

/** Rendered by a product page; shows nothing. Registers the product while the page is open. */
export function ChatProductContext({ name, code, url }: { name: string; code: string; url: string }) {
  useEffect(() => {
    const product = { name, code, url };
    setChatProduct(product);
    return () => setChatProduct(null);
  }, [name, code, url]);
  return null;
}
