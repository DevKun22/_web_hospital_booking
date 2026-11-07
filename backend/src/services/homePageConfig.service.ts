import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

const HOME_PAGE_CONFIG_KEY = "public_home_config";

export type HomePageSectionConfig = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  description: string;
  limit: number;
};

export type HomePageConfigValue = {
  announcement: {
    enabled: boolean;
    label: string;
    message: string;
    ctaLabel: string;
    ctaHref: string;
    startAt: string | null;
    endAt: string | null;
  };
  sections: {
    serviceHub: { enabled: boolean };
    departments: HomePageSectionConfig;
    doctors: HomePageSectionConfig;
    packages: HomePageSectionConfig;
    partners: HomePageSectionConfig;
  };
};

export const defaultHomePageConfig: HomePageConfigValue = {
  announcement: {
    enabled: true,
    label: "Chương trình sức khỏe",
    message:
      "Chủ động chọn bác sĩ, ngày khám và gói chăm sóc phù hợp cho bạn và gia đình.",
    ctaLabel: "Xem chương trình",
    ctaHref: "/goi-kham",
    startAt: null,
    endAt: null,
  },
  sections: {
    serviceHub: { enabled: true },
    departments: {
      enabled: true,
      eyebrow: "Chuyên khoa mũi nhọn",
      title: "Trung tâm chẩn đoán và điều trị toàn diện",
      description:
        "Tìm đúng chuyên khoa theo nhu cầu khám và xem thông tin trước khi đặt lịch.",
      limit: 4,
    },
    doctors: {
      enabled: true,
      eyebrow: "Chuyên gia đầu ngành",
      title: "Bác sĩ tiêu biểu đang tiếp nhận lịch khám",
      description:
        "Xem chuyên môn, đánh giá, chi phí và các giờ khám gần nhất từ dữ liệu hệ thống.",
      limit: 3,
    },
    packages: {
      enabled: true,
      eyebrow: "Chủ động phòng ngừa bệnh",
      title: "Gói khám sức khỏe và tầm soát toàn diện",
      description:
        "So sánh minh bạch chi phí, hạng mục thực hiện và chính sách hỗ trợ BHYT.",
      limit: 3,
    },
    partners: {
      enabled: true,
      eyebrow: "Mạng lưới đồng hành",
      title: "Kết nối hệ sinh thái chăm sóc sức khỏe",
      description: "Các đơn vị hợp tác đã được bệnh viện xác thực và công bố.",
      limit: 12,
    },
  },
};

type HomePageConfigInput = {
  announcement?: Partial<HomePageConfigValue["announcement"]>;
  sections?: {
    serviceHub?: Partial<HomePageConfigValue["sections"]["serviceHub"]>;
    departments?: Partial<HomePageSectionConfig>;
    doctors?: Partial<HomePageSectionConfig>;
    packages?: Partial<HomePageSectionConfig>;
    partners?: Partial<HomePageSectionConfig>;
  };
};

const toPrismaJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const asRecord = (value: Prisma.JsonValue | null | undefined) =>
  value && !Array.isArray(value) && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};

const normalize = (
  value: Prisma.JsonValue | null | undefined,
): HomePageConfigValue => {
  const record = asRecord(value);
  const announcement = asRecord(record.announcement as Prisma.JsonValue);
  const sections = asRecord(record.sections as Prisma.JsonValue);

  return {
    announcement: {
      ...defaultHomePageConfig.announcement,
      ...announcement,
    } as HomePageConfigValue["announcement"],
    sections: {
      serviceHub: {
        ...defaultHomePageConfig.sections.serviceHub,
        ...asRecord(sections.serviceHub as Prisma.JsonValue),
      } as HomePageConfigValue["sections"]["serviceHub"],
      departments: {
        ...defaultHomePageConfig.sections.departments,
        ...asRecord(sections.departments as Prisma.JsonValue),
      } as HomePageSectionConfig,
      doctors: {
        ...defaultHomePageConfig.sections.doctors,
        ...asRecord(sections.doctors as Prisma.JsonValue),
      } as HomePageSectionConfig,
      packages: {
        ...defaultHomePageConfig.sections.packages,
        ...asRecord(sections.packages as Prisma.JsonValue),
      } as HomePageSectionConfig,
      partners: {
        ...defaultHomePageConfig.sections.partners,
        ...asRecord(sections.partners as Prisma.JsonValue),
      } as HomePageSectionConfig,
    },
  };
};

class HomePageConfigService {
  async get() {
    const setting = await prisma.siteSetting.upsert({
      where: { key: HOME_PAGE_CONFIG_KEY },
      update: {},
      create: {
        key: HOME_PAGE_CONFIG_KEY,
        value: toPrismaJson(defaultHomePageConfig),
        description: "Public home page content and visibility settings",
      },
    });

    return { ...setting, value: normalize(setting.value) };
  }

  async update(input: HomePageConfigInput) {
    const current = await this.get();
    const nextValue = normalize({
      announcement: {
        ...current.value.announcement,
        ...input.announcement,
      },
      sections: {
        serviceHub: {
          ...current.value.sections.serviceHub,
          ...input.sections?.serviceHub,
        },
        departments: {
          ...current.value.sections.departments,
          ...input.sections?.departments,
        },
        doctors: {
          ...current.value.sections.doctors,
          ...input.sections?.doctors,
        },
        packages: {
          ...current.value.sections.packages,
          ...input.sections?.packages,
        },
        partners: {
          ...current.value.sections.partners,
          ...input.sections?.partners,
        },
      },
    } as unknown as Prisma.JsonValue);

    const setting = await prisma.siteSetting.update({
      where: { key: HOME_PAGE_CONFIG_KEY },
      data: { value: toPrismaJson(nextValue) },
    });

    return { ...setting, value: nextValue };
  }
}

export default new HomePageConfigService();
