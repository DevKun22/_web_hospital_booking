import { z } from "zod";

const optionalText = (max = 500) => z.string().trim().max(max).nullable().optional();
const publicHref = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      /^https:\/\//i.test(value),
    "Đường dẫn phải là đường dẫn nội bộ hoặc URL HTTPS",
  );
const optionalPublicHref = z.union([publicHref, z.null()]).optional();

export const updateSiteSettingsSchema = z.object({
  hospitalName: optionalText(120),
  logo: optionalText(1000),
  logoAssetId: z.string().uuid("Logo khong hop le").nullable().optional(),
  favicon: optionalText(1000),
  faviconAssetId: z.string().uuid("Favicon khong hop le").nullable().optional(),
  hotline: optionalText(50),
  emergencyHotline: optionalText(50),
  email: optionalText(120),
  address: optionalText(500),
  workingHours: optionalText(500),
  mapUrl: optionalText(1000),
  socialLinks: z.record(z.string(), z.string().trim().max(1000)).optional(),
});

const homeSectionSchema = z.object({
  enabled: z.boolean().optional(),
  eyebrow: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(500).optional(),
  limit: z.number().int().min(1).max(12).optional(),
});

export const updateHomePageConfigSchema = z.object({
  announcement: z
    .object({
      enabled: z.boolean().optional(),
      label: z.string().trim().min(1).max(120).optional(),
      message: z.string().trim().min(1).max(500).optional(),
      ctaLabel: z.string().trim().min(1).max(80).optional(),
      ctaHref: publicHref.optional(),
      startAt: z.string().datetime().nullable().optional(),
      endAt: z.string().datetime().nullable().optional(),
    })
    .optional(),
  sections: z
    .object({
      serviceHub: z.object({ enabled: z.boolean().optional() }).optional(),
      departments: homeSectionSchema.optional(),
      doctors: homeSectionSchema.optional(),
      packages: homeSectionSchema.optional(),
      partners: homeSectionSchema.optional(),
    })
    .optional(),
});

const bannerBaseSchema = z.object({
  title: z.string("Tieu de banner la bat buoc").trim().min(1, "Tieu de banner la bat buoc").max(160),
  subtitle: optionalText(500),
  image: optionalText(1000),
  imageAssetId: z.string().uuid("Anh banner khong hop le").optional(),
  mobileImage: optionalText(1000),
  mobileImageAssetId: z.string().uuid("Anh mobile banner khong hop le").nullable().optional(),
  linkUrl: optionalPublicHref,
  target: z.enum(["_self", "_blank"]).nullable().optional(),
  position: z
    .enum(["HOME_HERO", "HOME_PARTNER", "HOME_PROMO", "HOME_DEPARTMENT", "FOOTER"])
    .default("HOME_HERO"),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
});

export const createBannerSchema = bannerBaseSchema.refine((value) => Boolean(value.image || value.imageAssetId), {
  path: ["imageAssetId"],
  message: "Can truyen image hoac imageAssetId",
});

export const updateBannerSchema = bannerBaseSchema.partial();

export const createPublicFAQSchema = z.object({
  question: z.string("Cau hoi la bat buoc").trim().min(1, "Cau hoi la bat buoc").max(500),
  answer: z.string("Cau tra loi la bat buoc").trim().min(1, "Cau tra loi la bat buoc").max(3000),
  category: optionalText(120),
  keywords: z
    .array(z.string().trim().min(1).max(80))
    .max(20, "Tối đa 20 từ khóa")
    .optional(),
  order: z.number().int().min(0).default(0),
  showOnWeb: z.boolean().default(true),
  useInChatbot: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

// Không dùng .partial() trên schema có default để PATCH không ghi đè giá trị cũ.
export const updatePublicFAQSchema = z.object({
  question: createPublicFAQSchema.shape.question.optional(),
  answer: createPublicFAQSchema.shape.answer.optional(),
  category: optionalText(120),
  keywords: createPublicFAQSchema.shape.keywords,
  order: z.number().int().min(0).optional(),
  showOnWeb: z.boolean().optional(),
  useInChatbot: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
