"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import {
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardSurface,
} from "@/components/dashboard/dashboard-ui";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatVietnamDateTime } from "@/lib/date";
import { can } from "@/lib/permissions";

type StockMedicine = { id: string; code: string; name: string; unit: string; stockQuantity: number };

type PrescriptionItem = {
  id: string;
  medicineName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  unit: string | null;
  instruction: string | null;
  medicineId: string | null;
  dispensedQuantity: number;
  medicine: StockMedicine | null;
};

type QueuePrescription = {
  id: string;
  prescriptionCode: string;
  note: string | null;
  issuedAt: string | null;
  dispenseStatus: "NOT_DISPENSED" | "DISPENSED";
  dispensedAt: string | null;
  dispenseNote: string | null;
  patient: { fullName: string; phone: string | null };
  doctor: { title: string | null; user: { fullName: string } };
  appointment: { bookingCode: string; allergies: string | null };
  dispensedBy: { fullName: string } | null;
  items: PrescriptionItem[];
};

type Paged<T> = { items: T[]; pagination: { total: number } };

const OUTSIDE = "";

export default function PharmacyQueuePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canDispense = can(user, "pharmacy.dispense");
  const [status, setStatus] = useState<"NOT_DISPENSED" | "DISPENSED">("NOT_DISPENSED");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Lựa chọn thuốc kho của dược sĩ theo từng dòng; dòng chưa chọn dùng thuốc đã gắn sẵn.
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");

  const queueQuery = useQuery({
    queryKey: ["dashboard", "pharmacy", "queue", status, appliedSearch],
    queryFn: () =>
      apiRequest<Paged<QueuePrescription>>("/dashboard/pharmacy/prescriptions", {
        query: { dispenseStatus: status, q: appliedSearch || undefined, limit: 50 },
      }),
    refetchInterval: 30_000,
  });
  const medicinesQuery = useQuery({
    queryKey: ["dashboard", "pharmacy", "medicine-options"],
    queryFn: () =>
      apiRequest<Paged<StockMedicine>>("/dashboard/pharmacy/medicines", {
        query: { isActive: "true", limit: 100 },
      }),
    staleTime: 15_000,
  });

  const selected = queueQuery.data?.items.find((item) => item.id === selectedId) || null;
  const medicines = medicinesQuery.data?.items || [];

  const pickedMedicineId = (item: PrescriptionItem) =>
    item.id in picks ? picks[item.id] : (item.medicineId ?? OUTSIDE);

  const stockWarnings = selected
    ? selected.items.flatMap((item) => {
        const medicineId = pickedMedicineId(item);
        if (!medicineId) return [];
        const medicine = medicines.find((entry) => entry.id === medicineId);
        if (!medicine) return [];
        const needed = selected.items
          .filter((other) => pickedMedicineId(other) === medicineId)
          .reduce((sum, other) => sum + (other.quantity || 0), 0);
        return needed > medicine.stockQuantity
          ? [`${medicine.name}: cần ${needed}, tồn ${medicine.stockQuantity}`]
          : [];
      })
    : [];

  const dispenseMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/dashboard/pharmacy/prescriptions/${selected!.id}/dispense`, {
        method: "POST",
        body: {
          confirmed,
          note: note.trim() || null,
          lines: selected!.items.map((item) => ({
            itemId: item.id,
            medicineId: pickedMedicineId(item) || null,
          })),
        },
      }),
    onSuccess: async () => {
      setSelectedId(null);
      setPicks({});
      setConfirmed(false);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "pharmacy"] });
    },
  });

  const select = (id: string) => {
    setSelectedId(id);
    setPicks({});
    setConfirmed(false);
    setNote("");
    dispenseMutation.reset();
  };
  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
  };

  return (
    <div className="space-y-6">
      <DashboardFeedback
        error={dispenseMutation.error instanceof Error ? dispenseMutation.error.message : undefined}
        notice={dispenseMutation.isSuccess ? "Đã cấp thuốc và trừ kho" : undefined}
        onDismiss={() => dispenseMutation.reset()}
      />
      <DashboardPageHeader
        eyebrow="Khu làm việc dược sĩ"
        title="Cấp thuốc theo đơn"
        description="Kiểm tra đơn, chọn thuốc trong kho cho từng dòng rồi cấp nguyên đơn. Kho chỉ bị trừ khi toàn bộ đơn đủ thuốc."
        actions={
          <button
            type="button"
            onClick={() => void queueQuery.refetch()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)]"
          >
            <RefreshCw className={`h-4 w-4 ${queueQuery.isFetching ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <DashboardSurface className="overflow-hidden">
          <div className="space-y-3 border-b border-[var(--border-soft)] p-4">
            <div className="flex gap-2">
              {(["NOT_DISPENSED", "DISPENSED"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setStatus(value);
                    setSelectedId(null);
                  }}
                  className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${status === value ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] hover:bg-[var(--surface-soft)]"}`}
                >
                  {value === "NOT_DISPENSED" ? "Chờ cấp" : "Đã cấp"}
                </button>
              ))}
            </div>
            <form onSubmit={applySearch} className="flex gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Mã đơn, tên hoặc SĐT người khám"
                className="min-h-10 w-full rounded-md border border-[var(--border)] px-3 text-sm"
              />
              <button type="submit" className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--surface-soft)]">
                Tìm
              </button>
            </form>
          </div>
          {queueQuery.isLoading ? <p className="p-4 text-sm text-[var(--text-muted)]">Đang tải...</p> : null}
          {queueQuery.error ? (
            <p className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {queueQuery.error instanceof Error ? queueQuery.error.message : "Không tải được hàng đợi"}
            </p>
          ) : null}
          {queueQuery.data && queueQuery.data.items.length === 0 ? (
            <div className="p-4">
              <DashboardEmptyState
                title={status === "NOT_DISPENSED" ? "Không có đơn chờ cấp" : "Chưa có đơn đã cấp"}
                description="Đơn xuất hiện ở đây sau khi bác sĩ phát hành."
              />
            </div>
          ) : null}
          <ul className="divide-y divide-[var(--border-soft)]">
            {queueQuery.data?.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => select(item.id)}
                  className={`w-full p-4 text-left hover:bg-[var(--surface-soft)] ${selectedId === item.id ? "bg-[var(--surface-soft)]" : ""}`}
                >
                  <p className="font-semibold">{item.prescriptionCode}</p>
                  <p className="text-sm">{item.patient.fullName}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {item.items.length} dòng thuốc ·{" "}
                    {item.issuedAt ? formatVietnamDateTime(item.issuedAt) : "—"}
                  </p>
                  {item.appointment.allergies ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-800">
                      <AlertTriangle className="h-3 w-3" /> Có khai báo dị ứng
                    </p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </DashboardSurface>

        <DashboardSurface className="p-5">
          {!selected ? (
            <DashboardEmptyState title="Chọn một đơn" description="Chi tiết và thao tác cấp thuốc hiện ở đây." />
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">{selected.prescriptionCode}</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {selected.patient.fullName}
                  {selected.patient.phone ? ` · ${selected.patient.phone}` : ""} · Lịch {selected.appointment.bookingCode} ·{" "}
                  {selected.doctor.title ? `${selected.doctor.title} ` : ""}
                  {selected.doctor.user.fullName}
                </p>
                {selected.note ? <p className="mt-2 text-sm">Ghi chú bác sĩ: {selected.note}</p> : null}
              </div>

              {selected.appointment.allergies ? (
                <div role="alert" className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Dị ứng đã khai báo:</strong> {selected.appointment.allergies}
                  </span>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-soft)] text-left">
                      <th className="py-2 pr-3 font-semibold">Thuốc trong đơn</th>
                      <th className="py-2 pr-3 font-semibold">SL</th>
                      <th className="py-2 font-semibold">Thuốc trong kho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-soft)]">
                    {selected.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 pr-3">
                          <p className="font-medium">{item.medicineName}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {[item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ") || "—"}
                          </p>
                          {item.instruction ? <p className="text-xs text-[var(--text-muted)]">{item.instruction}</p> : null}
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {item.quantity ?? "—"} {item.unit || ""}
                        </td>
                        <td className="py-3">
                          {selected.dispenseStatus === "DISPENSED" ? (
                            <span>
                              {item.medicine
                                ? `${item.medicine.name} (đã cấp ${item.dispensedQuantity})`
                                : "Thuốc mua ngoài"}
                            </span>
                          ) : (
                            <select
                              value={pickedMedicineId(item)}
                              disabled={!canDispense}
                              onChange={(event) =>
                                setPicks((current) => ({ ...current, [item.id]: event.target.value }))
                              }
                              className="w-full rounded-md border border-[var(--border)] px-2 py-2 text-sm"
                            >
                              <option value={OUTSIDE}>Thuốc mua ngoài (không trừ kho)</option>
                              {medicines.map((medicine) => (
                                <option key={medicine.id} value={medicine.id}>
                                  {medicine.name} — tồn {medicine.stockQuantity} {medicine.unit}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selected.dispenseStatus === "DISPENSED" ? (
                <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Đã cấp {selected.dispensedAt ? formatVietnamDateTime(selected.dispensedAt) : ""}
                  {selected.dispensedBy ? ` bởi ${selected.dispensedBy.fullName}` : ""}
                  {selected.dispenseNote ? ` — ${selected.dispenseNote}` : ""}
                </p>
              ) : canDispense ? (
                <div className="space-y-3 border-t border-[var(--border-soft)] pt-4">
                  {stockWarnings.length > 0 ? (
                    <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      Không đủ tồn kho: {stockWarnings.join("; ")}. Nhập thêm thuốc trước khi cấp.
                    </p>
                  ) : null}
                  <label className="block text-sm">
                    <span className="font-medium">Ghi chú cấp thuốc (không bắt buộc)</span>
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <span>Tôi đã kiểm tra đơn: dị ứng, liều dùng và thuốc được chọn đúng với đơn của bác sĩ.</span>
                  </label>
                  <button
                    type="button"
                    disabled={!confirmed || stockWarnings.length > 0 || dispenseMutation.isPending}
                    onClick={() => dispenseMutation.mutate()}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {dispenseMutation.isPending ? "Đang cấp..." : "Cấp thuốc cho cả đơn"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </DashboardSurface>
      </div>
    </div>
  );
}
