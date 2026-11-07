import BannerService from "./banner.service.js";
import PackageService from "./package.service.js";
import PublicDepartmentService from "./publicDepartment.service.js";
import PublicDoctorService from "./publicDoctor.service.js";
import PublicFAQService from "./faq.service.js";
import SiteSettingsService from "./siteSettings.service.js";
import HomePageConfigService from "./homePageConfig.service.js";

export type PublicBootstrapView = "full" | "featured" | "catalog";

type PublicBootstrapData = {
  view: PublicBootstrapView;
  siteSettings:
    | Awaited<ReturnType<typeof SiteSettingsService.get>>["value"]
    | null;
  homeConfig:
    | Awaited<ReturnType<typeof HomePageConfigService.get>>["value"]
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

    const [settings, homePageSetting] = await Promise.all([
      isCatalog ? Promise.resolve(null) : SiteSettingsService.get(),
      isCatalog ? Promise.resolve(null) : HomePageConfigService.get(),
    ]);
    const homeConfig = homePageSetting?.value ?? null;
    const departmentLimit = isFeatured
      ? homeConfig?.sections.departments.limit ?? 4
      : undefined;
    const doctorLimit = isFeatured
      ? homeConfig?.sections.doctors.limit ?? 3
      : undefined;
    const packageLimit = isFeatured
      ? homeConfig?.sections.packages.limit ?? 3
      : undefined;
    const partnerLimit = isFeatured
      ? homeConfig?.sections.partners.limit ?? 12
      : 12;

    const [banners, departments, doctors, packages, faqs] =
      await Promise.all([
        isCatalog
          ? Promise.resolve([])
          : isFeatured
            ? Promise.all([
                BannerService.listPublic({ position: "HOME_HERO", limit: 5 }),
                BannerService.listPublic({ position: "HOME_PARTNER", limit: partnerLimit }),
              ]).then(([heroBanners, partnerBanners]) => [
                ...heroBanners,
                ...partnerBanners,
              ])
            : BannerService.listPublic({}),
        PublicDepartmentService.list({
          limit: departmentLimit,
          featured: isFeatured,
        }),
        PublicDoctorService.list({
          includeHighlights: isFeatured,
          limit: doctorLimit,
        }),
        PackageService.publicList({
          limit: packageLimit,
          featured: isFeatured,
        }),
        isCatalog || isFeatured
          ? Promise.resolve([])
          : PublicFAQService.listPublic({}),
      ]);

    return {
      view,
      siteSettings: settings?.value ?? null,
      homeConfig,
      banners,
      departments,
      doctors,
      packages,
      faqs,
    };
  }
}

export default new PublicBootstrapService();
