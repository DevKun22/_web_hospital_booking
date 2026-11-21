import type { FaqEntry, MedicalPackage, PackageItem } from "@/lib/types";
import { cleanFaq, cleanStrings } from "@/lib/content-clean";

// Gói khám: kiểu biểu mẫu, phép tính và dữ liệu gửi đi tách khỏi trang.

export type PackageForm = {
  name: string;
  slug: string;
  departmentId: string;
  basePrice: string;
  serviceFee: string;
  summary: string;
  description: string;
  note: string;
  audience: string[];
  resultTime: string;
  faq: FaqEntry[];
  image: string;
  imageAssetId: string;
  isPopular: boolean;
  isBHYTSupport: boolean;
  isActive: boolean;
};

export type ItemForm = {
  name: string;
  description: string;
  price: string;
  included: boolean;
  order: string;
};

export const emptyPackageForm: PackageForm = {
  name: "",
  slug: "",
  departmentId: "",
  basePrice: "",
  serviceFee: "0",
  summary: "",
  description: "",
  note: "",
  audience: [],
  resultTime: "",
  faq: [],
  image: "",
  imageAssetId: "",
  isPopular: false,
  isBHYTSupport: false,
  isActive: true,
};

export const emptyItemForm: ItemForm = { name: "", description: "", price: "0", included: true, order: "0" };

export const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "true", label: "Đang hiển thị" },
  { id: "false", label: "Tạm ẩn" },
];

export const getIncludedItemsTotal = (items: PackageItem[]) => items.filter((item) => item.included).reduce((total, item) => total + item.price, 0);

export const toPackageForm = (item: MedicalPackage): PackageForm => ({
  name: item.name,
  slug: item.slug || "",
  departmentId: item.departmentId || "",
  basePrice: String(item.basePrice),
  serviceFee: String(item.serviceFee || 0),
  summary: item.summary || "",
  description: item.description || "",
  note: item.note || "",
  audience: item.audience ?? [],
  resultTime: item.resultTime || "",
  faq: item.faq ?? [],
  image: item.image || "",
  imageAssetId: "",
  isPopular: item.isPopular,
  isBHYTSupport: item.isBHYTSupport,
  isActive: item.isActive,
});

export const toItemForm = (item: PackageItem): ItemForm => ({
  name: item.name,
  description: item.description || "",
  price: String(item.price || 0),
  included: item.included,
  order: String(item.order || 0),
});

export const buildPackagePayload = (form: PackageForm) => ({
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  departmentId: form.departmentId || null,
  basePrice: Number(form.basePrice || 0),
  serviceFee: Number(form.serviceFee || 0),
  summary: form.summary.trim() || null,
  description: form.description.trim() || null,
  note: form.note.trim() || null,
  audience: cleanStrings(form.audience),
  resultTime: form.resultTime.trim() || null,
  faq: cleanFaq(form.faq),
  image: form.image.trim() || null,
  imageAssetId: form.imageAssetId || undefined,
  isPopular: form.isPopular,
  isBHYTSupport: form.isBHYTSupport,
  isActive: form.isActive,
});

export const buildItemPayload = (form: ItemForm) => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  price: Number(form.price || 0),
  included: form.included,
  order: Number(form.order || 0),
});

export type PaneState = { kind: "new" } | { kind: "edit"; id: string } | null;
