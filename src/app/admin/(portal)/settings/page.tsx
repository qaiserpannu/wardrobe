import type { Metadata } from "next";
import { Suspense } from "react";
import { HeroImageUploader } from "@/components/admin/HeroImageUploader";
import { PageHeading } from "@/components/admin/PageHeading";
import { SettingsSectionForm } from "@/components/admin/SettingsSectionForm";
import { sectionFormValues, SETTINGS_SECTIONS as ALL_SECTIONS } from "@/lib/settings-form";
import { requireAdmin } from "@/server/auth/session";
import { getSettings, mediaUrl } from "@/server/services/settings";

export const metadata: Metadata = { title: "Settings" };

const SETTINGS_SECTIONS = ALL_SECTIONS.filter((section) => !section.page);
const cardClass = "scroll-mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6";

async function Settings() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <div className="max-w-3xl space-y-6">
      {SETTINGS_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className={cardClass} aria-labelledby={`${section.id}-heading`}>
          <h2 id={`${section.id}-heading`} className="font-display text-2xl font-medium">
            {section.title}
          </h2>
          {section.intro && <p className="mt-1 text-sm text-muted">{section.intro}</p>}
          <div className="mt-5">
            {section.id === "homepage" && (
              <div className="mb-6 border-b border-line pb-6">
                <p className="mb-3 text-sm font-medium">Homepage picture</p>
                <HeroImageUploader currentUrl={mediaUrl(settings.homepage.heroImageKey)} />
              </div>
            )}
            <SettingsSectionForm sectionId={section.id} values={sectionFormValues(section, settings)} />
          </div>
        </section>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeading title="Settings">Each box saves on its own, and the website changes straight away.</PageHeading>
      <nav aria-label="Settings sections" className="mb-6 flex max-w-3xl flex-wrap gap-2 text-sm">
        {SETTINGS_SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 hover:border-accent">
            {section.title}
          </a>
        ))}
      </nav>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Settings />
      </Suspense>
    </>
  );
}
