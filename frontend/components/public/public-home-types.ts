import type {
  Banner,
  DoctorProfile,
  HomePageConfigValue,
  MedicalPackage,
  PublicFAQ,
  SiteSettingsValue,
} from "@/lib/types";

export type PublicDepartment = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  symptomKeywords?: string[];
  triageDescription?: string | null;
};

export type PublicDepartmentCatalogItem = PublicDepartment & {
  doctorCount: number;
  packageCount: number;
  availableSlotCount: number;
  reviewSummary: {
    count: number;
    averageRating: number;
  };
};

export type PublicDepartmentCatalogResponse = {
  items: PublicDepartmentCatalogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    departmentCount: number;
    doctorCount: number;
    packageCount: number;
    departmentsWithSlots: number;
  };
};

export type PublicDepartmentOverview = {
  department: PublicDepartment;
  doctors: DoctorProfile[];
  packages: MedicalPackage[];
  summary: {
    doctorCount: number;
    packageCount: number;
    availableSlotCount: number;
    reviewSummary: {
      count: number;
      averageRating: number;
    };
  };
};

export type PublicPackageCatalogResponse = {
  items: MedicalPackage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    packageCount: number;
    popularCount: number;
    bhytSupportCount: number;
    departmentCount: number;
    minPrice: number;
    maxPrice: number;
  };
  filters: {
    departments: Array<{
      id: string;
      name: string;
      slug: string | null;
    }>;
  };
};

export type PublicHomeData = {
  settings: SiteSettingsValue | null;
  homeConfig: HomePageConfigValue | null;
  heroBanners: Banner[];
  promoBanners: Banner[];
  partnerBanners: Banner[];
  departments: PublicDepartment[];
  doctors: DoctorProfile[];
  packages: MedicalPackage[];
  faqs: PublicFAQ[];
};

export type HomeSelection = {
  departmentId: string;
  doctorId: string;
  packageId: string;
};

export const emptyHomeData: PublicHomeData = {
  settings: null,
  homeConfig: null,
  heroBanners: [],
  promoBanners: [],
  partnerBanners: [],
  departments: [],
  doctors: [],
  packages: [],
  faqs: [],
};
