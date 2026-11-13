"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  defaultDoctorFilters,
  doctorFiltersToUrl,
  hasActiveDoctorFilters,
  parseDoctorFilters,
  type DoctorFilters,
} from "@/features/doctors/filters";

const SEARCH_DEBOUNCE_MS = 250;

// Bộ lọc danh mục bác sĩ: khởi tạo từ địa chỉ trang, ghi ngược lại địa chỉ khi đổi (không thêm lịch sử),
// ô tìm kiếm chờ 250ms sau lần gõ cuối mới áp dụng, nhấn Tìm kiếm thì áp dụng ngay.
export function useDoctorFilters() {
  const params = useSearchParams();
  const [initial] = useState(() => parseDoctorFilters(new URLSearchParams(params.toString())));
  const [filters, setFilters] = useState<DoctorFilters>(initial);
  const [searchInput, setSearchInput] = useState(initial.search);

  useEffect(() => {
    const id = window.setTimeout(() => setFilters((current) => (current.search === searchInput.trim() ? current : { ...current, search: searchInput.trim(), page: 1 })), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    window.history.replaceState(null, "", doctorFiltersToUrl(filters, new URLSearchParams(window.location.search)));
  }, [filters]);

  // Đổi bất kỳ điều kiện nào thì quay về trang 1.
  const update = useCallback(
    (patch: Partial<Omit<DoctorFilters, "page" | "search">>) => setFilters((current) => ({ ...current, ...patch, page: 1 })),
    [],
  );
  const submitSearch = useCallback(() => setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 })), [searchInput]);
  const setPage = useCallback((page: number) => setFilters((current) => ({ ...current, page })), []);
  const reset = useCallback(() => {
    setSearchInput("");
    setFilters(defaultDoctorFilters);
  }, []);

  return {
    filters,
    searchInput,
    setSearchInput,
    update,
    submitSearch,
    setPage,
    reset,
    hasActiveFilters: hasActiveDoctorFilters({ ...filters, search: searchInput || filters.search }),
  };
}
