import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { PageHeading } from "@/components/admin/PageHeading";
import { requireAdmin } from "@/server/auth/session";
import { listAdminCategories, listGroupOptions } from "@/server/services/admin-categories";

export const metadata: Metadata = { title: "Categories" };

async function Categories() {
  await requireAdmin();
  const [groups, groupOptions] = await Promise.all([listAdminCategories(), listGroupOptions()]);
  return <CategoryManager groups={groups} groupOptions={groupOptions} />;
}

export default function CategoriesPage() {
  return (
    <>
      <PageHeading title="Categories">
        Groups (like Women) hold categories (like Sarees); items go in categories. The order here is the order in the shop&apos;s menu. Nothing
        is deleted: hide a category to take it, and its items, off the website.
      </PageHeading>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Categories />
      </Suspense>
    </>
  );
}
