import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/admin/PageHeading";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdmin } from "@/server/auth/session";
import { listCategoryOptions, listFieldSuggestions } from "@/server/services/admin-products";

export const metadata: Metadata = { title: "Add an item" };

const EMPTY = {
  name: "",
  description: "",
  categoryId: "",
  brand: "",
  size: "",
  color: "",
  fabric: "",
  pieces: "",
  stitching: "",
  occasion: "",
  imperfections: "",
  condition: "",
  price: "",
  isFeatured: false,
};

async function NewProduct() {
  await requireAdmin();
  const [categories, suggestions] = await Promise.all([listCategoryOptions(), listFieldSuggestions()]);
  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <ProductForm values={EMPTY} categories={categories} suggestions={suggestions} />
    </section>
  );
}

export default function NewProductPage() {
  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/admin/products" className="text-accent underline-offset-4 hover:underline">
          ← All items
        </Link>
      </p>
      <PageHeading title="Add an item">
        Fill in the details and save. The item starts as a draft that only you can see; you add photos and publish it on the next screen.
      </PageHeading>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewProduct />
      </Suspense>
    </>
  );
}
