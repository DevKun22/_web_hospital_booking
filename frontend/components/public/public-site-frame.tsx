import type { ReactNode } from "react";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { PublicSiteUtilities } from "@/components/public/public-site-utilities";
import { serverApiRequest } from "@/lib/server-api";
import type { SiteSettingsValue } from "@/lib/types";

async function getPublicSiteSettings() {
  try {
    return await serverApiRequest<SiteSettingsValue>("/site-settings", {
      next: { revalidate: 60 },
    });
  } catch {
    return null;
  }
}

export async function PublicSiteFrame({ children }: { children: ReactNode }) {
  const settings = await getPublicSiteSettings();

  return (
    <div id="main-content" tabIndex={-1} className="public-site min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <a className="ui-skip-link" href="#public-content">
        Bỏ qua điều hướng
      </a>
      <PublicSiteHeader settings={settings} />
      <div id="public-content" tabIndex={-1}>{children}</div>
      <PublicSiteFooter settings={settings} />
      <PublicSiteUtilities />
    </div>
  );
}
