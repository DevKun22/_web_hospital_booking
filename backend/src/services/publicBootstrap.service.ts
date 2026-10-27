import BannerService from "./banner.service.js";
import PackageService from "./package.service.js";
import PublicDepartmentService from "./publicDepartment.service.js";
import PublicDoctorService from "./publicDoctor.service.js";
import PublicFAQService from "./publicFAQ.service.js";
import SiteSettingsService from "./siteSettings.service.js";

export type PublicBootstrapView = "full" | "featured" | "catalog";

type PublicBootstrapData = {
  view: PublicBootstrapView;
  siteSettings:
    | Awaited<ReturnType<typeof SiteSettingsService.get>>["value"]
    | null;
  banners: Awaited<ReturnType<typeof BannerService.listPublic>>;
  departments: Awaited<ReturnType<typeof PublicDepartmentService.list>>;
  doctors: Awaited<ReturnType<typeof PublicDoctorService.list>>;
  packages: Awaited<ReturnType<typeof PackageService.publicList>>;
  faqs: Awaited<ReturnType<typeof PublicFAQService.listPublic>>;
};

const CACHE_FRESH_MS = 30_000;
const CACHE_MAX_STALE_MS = 5 * 60_000;

class PublicBootstrapService {
  private readonly cache = new Map<
    PublicBootstrapView,
    { freshUntil: number; expiresAt: number; data: PublicBootstrapData }
  >();

  private readonly inFlight = new Map<
    PublicBootstrapView,
    Promise<PublicBootstrapData>
  >();

  invalidate() {
    this.cache.clear();
  }

  async get(view: PublicBootstrapView): Promise<PublicBootstrapData> {
    const cached = this.cache.get(view);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      if (cached.freshUntil <= now && !this.inFlight.has(view)) {
        void this.refresh(view).catch(() => undefined);
      }
      return cached.data;
    }

    const pending = this.inFlight.get(view);
    if (pending) return pending;

    return this.refresh(view);
  }

  private refresh(view: PublicBootstrapView) {
    const request = this.load(view)
      .then((data) => {
        const now = Date.now();
        this.cache.set(view, {
          freshUntil: now + CACHE_FRESH_MS,
          expiresAt: now + CACHE_MAX_STALE_MS,
          data,
        });
        return data;
      })
      .finally(() => {
        this.inFlight.delete(view);
      });

    this.inFlight.set(view, request);
    return request;
  }

  private async load(view: PublicBootstrapView): Promise<PublicBootstrapData> {
    const isCatalog = view === "catalog";
    const isFeatured = view === "featured";

    const [settings, banners, departments, doctors, packages, faqs] =
      await Promise.all([
        isCatalog ? Promise.resolve(null) : SiteSettingsService.get(),
        isCatalog
          ? Promise.resolve([])
          : BannerService.listPublic({
              position: isFeatured ? "HOME_HERO" : undefined,
            }),
        PublicDepartmentService.list({}),
        PublicDoctorService.list({
          includeHighlights: isFeatured,
          limit: isFeatured ? 4 : undefined,
        }),
        PackageService.publicList({ limit: isFeatured ? 5 : undefined }),
        isCatalog ? Promise.resolve([]) : PublicFAQService.listPublic({}),
      ]);

    return {
      view,
      siteSettings: settings?.value ?? null,
      banners,
      departments: isFeatured ? departments.slice(0, 6) : departments,
      doctors,
      packages,
      faqs: isFeatured ? faqs.slice(0, 5) : faqs,
    };
  }
}

export default new PublicBootstrapService();
