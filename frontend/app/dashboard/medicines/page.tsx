"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, RefreshCw } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import {
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardSurface,
} from "@/components/dashboard/dashboard-ui";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { ImportCsvPanel } from "@/components/dashboard/import-csv-panel";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatVietnamDateTime } from "@/lib/date";
import { can } from "@/lib/permissions";

type Medicine = {
  id: string;
  code: string;
  name: string;
  activeIngredient: string | null;
  strength: string | null;
  dosageForm: string | null;
  unit: string;
  stockQuantity: number;
  minStock: number;
  isActive: boolean;
};

type Movement = {
  id: string;
  type: "RECEIPT" | "DISPENSE" | "ADJUSTMENT";
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
  actor: { fullName: string };
  prescriptionItem: { prescription: { prescriptionCode: string } } | null;
};

type Paged<T> = { items: T[]; pagination: { total: number } };

const movementLabel = { RECEIPT: "Nhập kho", DISPENSE: "Cấp phát", ADJUSTMENT: "Điều chỉnh" } as const;
// Tệp mẫu cho nhập CSV: đúng tiêu đề cột mà máy chủ yêu cầu.
const CATALOG_TEMPLATE =
  "Mã thuốc,Tên thuốc,Đơn vị,Hoạt chất,Hàm lượng,Dạng bào chế,Mức tối thiểu,Ghi chú\r\nPARA500,Paracetamol 500mg,viên,Paracetamol,500mg,Viên nén,100,\r\n";
const RECEIPT_TEMPLATE = "Mã thuốc,Số lượng,Lý do\r\nPARA500,200,Phiếu nhập 01\r\n";
const emptyForm = { code: "", name: "", unit: "viên", strength: "", dosageForm: "", activeIngredient: "", minStock: "0" };

export default function MedicinesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canCatalog = can(user, "pharmacy.catalog");
  const canReceive = can(user, "pharmacy.receive");
  const canAdjust = can(user, "pharmacy.adjust");

  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [receiptQty, setReceiptQty] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const listQuery = useQuery({
    queryKey: ["dashboard", "pharmacy", "medicines", applied, lowOnly],
    queryFn: () =>
      apiRequest<Paged<Medicine>>("/dashboard/pharmacy/medicines", {
        query: { q: applied || undefined, lowStock: lowOnly ? "true" : undefined, limit: 100 },
      }),
  });
  const selected = listQuery.data?.items.find((item) => item.id === selectedId) || null;
  const movementsQuery = useQuery({
    queryKey: ["dashboard", "pharmacy", "movements", selectedId],
    queryFn: () =>
      apiRequest<Paged<Movement>>(`/dashboard/pharmacy/medicines/${selectedId}/movements`, {
        query: { limit: 30 },
      }),
    enabled: Boolean(selectedId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dashboard", "pharmacy"] });
  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/dashboard/pharmacy/medicines", {
        method: "POST",
        body: {
          code: form.code,
          name: form.name,
          unit: form.unit,
          strength: form.strength || null,
          dosageForm: form.dosageForm || null,
          activeIngredient: form.activeIngredient || null,
          minStock: Number(form.minStock) || 0,
        },
      }),
    onSuccess: async () => {
      setForm(emptyForm);
      await refresh();
    },
  });
  const receiveMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/dashboard/pharmacy/medicines/${selectedId}/receipts`, {
        method: "POST",
        body: { quantity: Number(receiptQty), reason: "Nhập kho" },
      }),
    onSuccess: async () => {
      setReceiptQty("");
      await refresh();
    },
  });
  const adjustMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/dashboard/pharmacy/medicines/${selectedId}/adjustments`, {
        method: "POST",
        body: { delta: Number(adjustDelta), reason: adjustReason },
      }),
    onSuccess: async () => {
      setAdjustDelta("");
      setAdjustReason("");
      await refresh();
    },
  });

  const mutations = [createMutation, receiveMutation, adjustMutation];
  const failed = mutations.find((item) => item.error instanceof Error)?.error as Error | undefined;
  const succeeded = mutations.some((item) => item.isSuccess);
  const submit = (action: () => void) => (event: FormEvent) => {
    event.preventDefault();
    action();
  };

  return (
    <div className="space-y-6">
      <DashboardFeedback
        error={failed?.message}
        notice={succeeded ? "Đã lưu thay đổi kho" : undefined}
        onDismiss={() => mutations.forEach((item) => item.reset())}
      />
      <DashboardPageHeader
        eyebrow="Khu làm việc dược sĩ"
        title="Kho thuốc"
        description="Danh mục và tồn kho. Tồn chỉ thay đổi qua phiếu nhập, cấp thuốc theo đơn hoặc điều chỉnh có lý do; sổ kho không sửa hay xóa."
        actions={
          <div className="flex flex-wrap items-start gap-3">
            <ExportCsvButton path="/dashboard/pharmacy/medicines/export" fallbackName="ton-kho-thuoc.csv" ranged={false} label="Xuất tồn kho" />
            <ExportCsvButton path="/dashboard/pharmacy/movements/export" fallbackName="so-kho-thuoc.csv" label="Xuất sổ kho" />
            {canCatalog ? (
              <ImportCsvPanel
                path="/dashboard/pharmacy/import/catalog"
                title="Nhập danh mục từ CSV"
                templateName="mau-danh-muc-thuoc.csv"
                templateCsv={CATALOG_TEMPLATE}
                hint="Thêm thuốc mới hoặc cập nhật thuốc đã có theo Mã thuốc (ô trống = giữ nguyên). Không thay đổi tồn kho. Tối đa 500 dòng, có dòng lỗi thì không nhập gì."
                onDone={() => void refresh()}
              />
            ) : null}
            {canReceive ? (
              <ImportCsvPanel
                path="/dashboard/pharmacy/import/receipts"
                title="Nhập kho từ CSV"
                templateName="mau-nhap-kho.csv"
                templateCsv={RECEIPT_TEMPLATE}
                hint="Mỗi dòng là một phiếu nhập cho một thuốc đã có trong danh mục, ghi vào sổ kho như nhập tay. Mỗi mã thuốc chỉ một dòng. Tối đa 500 dòng."
                onDone={() => void refresh()}
              />
            ) : null}
            <button
              type="button"
              onClick={() => void listQuery.refetch()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)]"
            >
              <RefreshCw className={`h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`} />
              Làm mới
            </button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <DashboardSurface className="overflow-hidden">
          <form
            onSubmit={submit(() => setApplied(search.trim()))}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] p-4"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tên, mã hoặc hoạt chất"
              className="min-h-10 w-64 rounded-md border border-[var(--border)] px-3 text-sm"
            />
            <button type="submit" className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--surface-soft)]">
              Tìm
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} className="h-4 w-4" />
              Chỉ thuốc sắp hết
            </label>
          </form>
          {listQuery.isLoading ? <p className="p-4 text-sm text-[var(--text-muted)]">Đang tải...</p> : null}
          {listQuery.data && listQuery.data.items.length === 0 ? (
            <div className="p-4">
              <DashboardEmptyState title="Chưa có thuốc" description="Thêm thuốc vào danh mục rồi nhập kho." />
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <tbody className="divide-y divide-[var(--border-soft)]">
                {listQuery.data?.items.map((item) => {
                  const low = item.stockQuantity <= item.minStock;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`cursor-pointer hover:bg-[var(--surface-soft)] ${selectedId === item.id ? "bg-[var(--surface-soft)]" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {item.name} {item.strength || ""}
                          {!item.isActive ? <span className="ml-2 text-xs text-[var(--text-muted)]">(ngừng dùng)</span> : null}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {item.code}
                          {item.dosageForm ? ` · ${item.dosageForm}` : ""}
                        </p>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${low ? "text-red-700" : ""}`}>
                        {item.stockQuantity} {item.unit}
                        {low ? <span className="block text-xs font-normal">Sắp hết (mức tối thiểu {item.minStock})</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashboardSurface>

        <div className="space-y-6">
          {selected ? (
            <DashboardSurface className="space-y-4 p-5">
              <div>
                <h2 className="font-semibold">{selected.name}</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Tồn hiện tại: {selected.stockQuantity} {selected.unit}
                </p>
              </div>
              {canReceive ? (
                <form onSubmit={submit(() => receiveMutation.mutate())} className="flex items-end gap-2">
                  <label className="block text-sm">
                    <span className="font-medium">Nhập kho</span>
                    <input
                      type="number"
                      min={1}
                      value={receiptQty}
                      onChange={(event) => setReceiptQty(event.target.value)}
                      className="mt-1 w-28 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    />
                  </label>
                  <button type="submit" disabled={!receiptQty || receiveMutation.isPending} className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60">
                    Nhập
                  </button>
                </form>
              ) : null}
              {canAdjust ? (
                <form onSubmit={submit(() => adjustMutation.mutate())} className="space-y-2">
                  <p className="text-sm font-medium">Điều chỉnh tồn (kiểm kê, hủy thuốc hỏng)</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={adjustDelta}
                      onChange={(event) => setAdjustDelta(event.target.value)}
                      placeholder="±SL"
                      className="w-24 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    />
                    <input
                      value={adjustReason}
                      onChange={(event) => setAdjustReason(event.target.value)}
                      placeholder="Lý do (bắt buộc)"
                      className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!adjustDelta || Number(adjustDelta) === 0 || !adjustReason.trim() || adjustMutation.isPending}
                    className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)] disabled:opacity-60"
                  >
                    Điều chỉnh
                  </button>
                </form>
              ) : null}
              <div>
                <p className="mb-2 text-sm font-medium">Sổ kho gần đây</p>
                <ul className="divide-y divide-[var(--border-soft)] text-sm">
                  {movementsQuery.data?.items.map((move) => (
                    <li key={move.id} className="flex items-start justify-between gap-3 py-2">
                      <span>
                        {movementLabel[move.type]}
                        {move.prescriptionItem ? ` · đơn ${move.prescriptionItem.prescription.prescriptionCode}` : ""}
                        {move.reason ? ` · ${move.reason}` : ""}
                        <span className="block text-xs text-[var(--text-muted)]">
                          {formatVietnamDateTime(move.createdAt)} · {move.actor.fullName}
                        </span>
                      </span>
                      <span className="text-right font-semibold whitespace-nowrap">
                        {move.quantity > 0 ? "+" : ""}
                        {move.quantity}
                        <span className="block text-xs font-normal text-[var(--text-muted)]">còn {move.balanceAfter}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </DashboardSurface>
          ) : null}

          {canCatalog ? (
            <DashboardSurface className="p-5">
              <h2 className="mb-3 inline-flex items-center gap-2 font-semibold">
                <PackagePlus className="h-4 w-4" /> Thêm thuốc vào danh mục
              </h2>
              <form onSubmit={submit(() => createMutation.mutate())} className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["code", "Mã thuốc *"],
                    ["name", "Tên thuốc *"],
                    ["unit", "Đơn vị *"],
                    ["strength", "Hàm lượng"],
                    ["dosageForm", "Dạng bào chế"],
                    ["activeIngredient", "Hoạt chất"],
                    ["minStock", "Mức tồn tối thiểu"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    <span className="font-medium">{label}</span>
                    <input
                      value={form[key]}
                      onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    />
                  </label>
                ))}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={!form.code.trim() || !form.name.trim() || !form.unit.trim() || createMutation.isPending}
                    className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Thêm thuốc
                  </button>
                </div>
              </form>
            </DashboardSurface>
          ) : null}
        </div>
      </div>
    </div>
  );
}
