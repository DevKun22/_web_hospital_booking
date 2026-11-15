"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DsField, DsInput, DsStatusPill, type DsTone } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { MedicineAvailability, MedicineOption } from "@/lib/types";

export const availabilityLabel: Record<MedicineAvailability, string> = {
  IN_STOCK: "Còn hàng",
  LOW: "Sắp hết",
  OUT: "Hết hàng",
};

export const availabilityTone: Record<MedicineAvailability, DsTone> = {
  IN_STOCK: "good",
  LOW: "warn",
  OUT: "bad",
};

export const medicineDisplayName = (option: Pick<MedicineOption, "name" | "strength">) =>
  [option.name, option.strength].filter(Boolean).join(" ");

// Chọn thuốc từ danh mục kho khi kê đơn. Bác sĩ chỉ thấy mức khả dụng, không thấy số tồn hay giá.
export function MedicinePicker({ onPick }: { onPick: (option: MedicineOption) => void }) {
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim());
  const options = useQuery({
    queryKey: ["dashboard", "prescriptions", "medicine-options", term],
    queryFn: () =>
      apiRequest<MedicineOption[]>("/dashboard/prescriptions/medicine-options", { query: { q: term || undefined, limit: 8 } }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const items = options.data ?? [];

  return (
    <DsField
      label="Chọn từ danh mục thuốc"
      htmlFor="medicine-search"
      hint="Không thấy thuốc cần kê thì cứ gõ tên bên dưới: thuốc đó coi như người khám tự mua."
    >
      <DsInput
        id="medicine-search"
        value={search}
        placeholder="Gõ tên thuốc, mã hoặc hoạt chất để tìm"
        onChange={(event) => setSearch(event.target.value)}
      />
      {options.isError ? (
        <small style={{ color: "var(--ds-bad)" }}>Không tải được danh mục thuốc. Vẫn gõ tên thuốc bên dưới được.</small>
      ) : null}
      {search.trim() && !options.isLoading && items.length === 0 ? (
        <small style={{ color: "var(--ds-muted)" }}>Không có thuốc phù hợp trong danh mục.</small>
      ) : null}
      {items.length > 0 ? (
        <div role="listbox" aria-label="Kết quả tìm thuốc" style={{ marginTop: 6 }}>
          {items.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={false}
              className="ds-listrow"
              onClick={() => {
                onPick(option);
                setSearch("");
              }}
            >
              <span className="ds-listrow__main">
                <strong>{medicineDisplayName(option)}</strong>
                <small>{[option.code, option.dosageForm, option.unit].filter(Boolean).join(" · ")}</small>
              </span>
              <DsStatusPill tone={availabilityTone[option.availability]}>{availabilityLabel[option.availability]}</DsStatusPill>
            </button>
          ))}
        </div>
      ) : null}
    </DsField>
  );
}
