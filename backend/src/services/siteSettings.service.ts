import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import MediaAssetService from "./mediaAsset.service.js";

const SITE_SETTINGS_KEY = "public_site_settings";

const defaultSiteSettings = {
  hospitalName: "Hospital Booking",
  logo: null,
  favicon: null,
  hotline: null,
  emergencyHotline: null,
  email: null,
  address: null,
  workingHours: null,
  mapUrl: null,
  socialLinks: {},
};

type SiteSettingsInput = Partial<typeof defaultSiteSettings> & {
  logoAssetId?: string | null;
  faviconAssetId?: string | null;
};

const toPrismaJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

class SiteSettingsService {
  async get() {
    const existingSetting = await prisma.appSetting.findUnique({
      where: { scope_key: { scope: "SITE", key: SITE_SETTINGS_KEY } },
    });

    const setting =
      existingSetting ||
      (await prisma.appSetting.create({
        data: {
          scope: "SITE",
          key: SITE_SETTINGS_KEY,
          value: toPrismaJson(defaultSiteSettings),
          description: "Public website display settings",
        },
      }));

    return {
      ...setting,
      value: {
        ...defaultSiteSettings,
        ...(setting.value as Record<string, unknown>),
      },
    };
  }

  async update(input: SiteSettingsInput) {
    const current = await this.get();
    const logoAsset =
      input.logoAssetId === undefined
        ? null
        : input.logoAssetId
          ? await MediaAssetService.attachAsset(
              input.logoAssetId,
              "SITE_SETTING",
              SITE_SETTINGS_KEY,
            )
          : null;
    const faviconAsset =
      input.faviconAssetId === undefined
        ? null
        : input.faviconAssetId
          ? await MediaAssetService.attachAsset(
              input.faviconAssetId,
              "SITE_SETTING",
              SITE_SETTINGS_KEY,
            )
          : null;
    const { logoAssetId, faviconAssetId, ...settingsInput } = input;
    const nextValue = {
      ...(current.value as Record<string, unknown>),
      ...settingsInput,
      ...(logoAssetId === null ? { logo: null } : {}),
      ...(faviconAssetId === null ? { favicon: null } : {}),
      ...(logoAsset ? { logo: logoAsset.url } : {}),
      ...(faviconAsset ? { favicon: faviconAsset.url } : {}),
    };

    const setting = await prisma.appSetting.update({
      where: { scope_key: { scope: "SITE", key: SITE_SETTINGS_KEY } },
      data: {
        value: toPrismaJson(nextValue),
      },
    });

    const currentValue = current.value as Record<string, unknown>;
    const currentLogo =
      typeof currentValue.logo === "string" ? currentValue.logo : null;
    const currentFavicon =
      typeof currentValue.favicon === "string" ? currentValue.favicon : null;
    const nextLogo = typeof nextValue.logo === "string" ? nextValue.logo : null;
    const nextFavicon =
      typeof nextValue.favicon === "string" ? nextValue.favicon : null;

    if (nextLogo !== currentLogo) {
      await MediaAssetService.detachOwnerAssetByUrl(
        "SITE_SETTING",
        SITE_SETTINGS_KEY,
        currentLogo,
      );
    }
    if (nextFavicon !== currentFavicon) {
      await MediaAssetService.detachOwnerAssetByUrl(
        "SITE_SETTING",
        SITE_SETTINGS_KEY,
        currentFavicon,
      );
    }

    return setting;
  }
}

export default new SiteSettingsService();
