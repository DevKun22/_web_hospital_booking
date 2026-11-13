export type DoctorSort = "NAME_ASC" | "EXPERIENCE_DESC";

export type DoctorFilters = {
  search: string;
  departmentId: string;
  minExperience: string;
  availableToday: boolean;
  sort: DoctorSort;
  page: number;
};

export const PAGE_SIZE = 9;
const BASE_PATH = "/bac-si";

export const defaultDoctorFilters: DoctorFilters = {
  search: "",
  departmentId: "",
  minExperience: "",
  availableToday: false,
  sort: "NAME_ASC",
  page: 1,
};

// Đọc bộ lọc từ địa chỉ trang (?search=&departmentId=&...); giá trị lạ rơi về mặc định.
export function parseDoctorFilters(params: URLSearchParams): DoctorFilters {
  const page = Number(params.get("page"));
  return {
    search: params.get("search") || "",
    departmentId: params.get("departmentId") || "",
    minExperience: params.get("minExperience") || "",
    availableToday: params.get("availableToday") === "true",
    sort: params.get("sort") === "EXPERIENCE_DESC" ? "EXPERIENCE_DESC" : "NAME_ASC",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

// Ghi bộ lọc ra địa chỉ trang, chỉ giữ những giá trị khác mặc định để địa chỉ ngắn gọn, và giữ nguyên tham số khác.
export function doctorFiltersToUrl(filters: DoctorFilters, current = new URLSearchParams()): string {
  const params = new URLSearchParams(current);
  const set = (key: string, value: string, keep: boolean) => (keep ? params.set(key, value) : params.delete(key));
  set("search", filters.search.trim(), Boolean(filters.search.trim()));
  set("departmentId", filters.departmentId, Boolean(filters.departmentId));
  set("minExperience", filters.minExperience, Boolean(filters.minExperience));
  set("availableToday", "true", filters.availableToday);
  set("sort", filters.sort, filters.sort !== "NAME_ASC");
  set("page", String(filters.page), filters.page > 1);
  const query = params.toString();
  return query ? `${BASE_PATH}?${query}` : BASE_PATH;
}

export const hasActiveDoctorFilters = (filters: DoctorFilters) =>
  Boolean(filters.search || filters.departmentId || filters.minExperience || filters.availableToday || filters.sort !== "NAME_ASC");

// Tối đa 5 số trang quanh trang hiện tại.
export const buildPageNumbers = (page: number, totalPages: number) => {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
};
