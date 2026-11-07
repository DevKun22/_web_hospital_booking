import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import MediaAssetService from "./mediaAsset.service.js";

type BannerInput = {
  title?: string;
  subtitle?: string | null;
  image?: string;
  imageAssetId?: string;
  mobileImage?: string | null;
  mobileImageAssetId?: string | null;
  linkUrl?: string | null;
  target?: string | null;
  position?: string;
  order?: number;
  isActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
};

const bannerSelect = {
  id: true,
  title: true,
  subtitle: true,
  image: true,
  mobileImage: true,
  linkUrl: true,
  target: true,
  position: true,
  order: true,
  isActive: true,
  startAt: true,
  endAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BannerSelect;

const parseDate = (value?: string | null) => (value ? new Date(value) : value);

class BannerService {
  async listPublic(query: { position?: string; limit?: number }) {
    const now = new Date();

    return prisma.banner.findMany({
      where: {
        position: query.position,
        isActive: true,
        OR: [{ startAt: null }, { startAt: { lte: now } }],
        AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
      },
      select: bannerSelect,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: query.limit
        ? Math.min(Math.max(Math.trunc(query.limit), 1), 10)
        : undefined,
    });
  }

  async listDashboard(query: { position?: string; isActive?: boolean }) {
    return prisma.banner.findMany({
      where: {
        position: query.position,
        isActive: query.isActive,
      },
      select: bannerSelect,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  }

  async getById(id: string) {
    const banner = await prisma.banner.findUnique({
      where: { id },
      select: bannerSelect,
    });

    if (!banner) {
      throw new AppError("Không tìm thấy banner", 404);
    }

    return banner;
  }

  async create(input: Required<Pick<BannerInput, "title">> & BannerInput) {
    const imageAsset = input.imageAssetId
      ? await MediaAssetService.getUsableAsset(input.imageAssetId)
      : null;
    const mobileImageAsset = input.mobileImageAssetId
      ? await MediaAssetService.getUsableAsset(input.mobileImageAssetId)
      : null;

    const banner = await prisma.banner.create({
      data: {
        title: input.title,
        subtitle: input.subtitle,
        image: imageAsset?.url || input.image || "",
        mobileImage: mobileImageAsset?.url || input.mobileImage,
        linkUrl: input.linkUrl,
        target: input.target,
        position: input.position || "HOME_HERO",
        order: input.order || 0,
        isActive: input.isActive ?? true,
        startAt: parseDate(input.startAt),
        endAt: parseDate(input.endAt),
      },
      select: bannerSelect,
    });

    if (imageAsset) {
      await MediaAssetService.attachAsset(imageAsset.id, "BANNER", banner.id);
    }
    if (mobileImageAsset) {
      await MediaAssetService.attachAsset(
        mobileImageAsset.id,
        "BANNER",
        banner.id,
      );
    }

    return banner;
  }

  async update(id: string, input: BannerInput) {
    const currentBanner = await this.getById(id);
    const imageAsset =
      input.imageAssetId === undefined
        ? null
        : input.imageAssetId
          ? await MediaAssetService.attachAsset(
              input.imageAssetId,
              "BANNER",
              id,
            )
          : null;
    const mobileImageAsset =
      input.mobileImageAssetId === undefined
        ? null
        : input.mobileImageAssetId
          ? await MediaAssetService.attachAsset(
              input.mobileImageAssetId,
              "BANNER",
              id,
            )
          : null;

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        title: input.title,
        subtitle: input.subtitle,
        image: imageAsset ? imageAsset.url : input.image,
        mobileImage:
          input.mobileImageAssetId === null
            ? null
            : mobileImageAsset
              ? mobileImageAsset.url
              : input.mobileImage,
        linkUrl: input.linkUrl,
        target: input.target,
        position: input.position,
        order: input.order,
        isActive: input.isActive,
        startAt: parseDate(input.startAt),
        endAt: parseDate(input.endAt),
      },
      select: bannerSelect,
    });

    const nextImage = imageAsset ? imageAsset.url : input.image;
    const nextMobileImage =
      input.mobileImageAssetId === null
        ? null
        : mobileImageAsset
          ? mobileImageAsset.url
          : input.mobileImage;

    if (nextImage !== undefined && nextImage !== currentBanner.image) {
      await MediaAssetService.detachOwnerAssetByUrl(
        "BANNER",
        id,
        currentBanner.image,
      );
    }
    if (
      nextMobileImage !== undefined &&
      nextMobileImage !== currentBanner.mobileImage
    ) {
      await MediaAssetService.detachOwnerAssetByUrl(
        "BANNER",
        id,
        currentBanner.mobileImage,
      );
    }

    return banner;
  }

  async delete(id: string) {
    const banner = await this.getById(id);

    await prisma.$transaction(async (tx) => {
      await tx.mediaAsset.updateMany({
        where: {
          ownerType: "BANNER",
          ownerId: id,
        },
        data: {
          isUsed: false,
          ownerType: null,
          ownerId: null,
        },
      });

      await tx.banner.delete({
        where: { id },
      });
    });

    return banner;
  }
}

export default new BannerService();
