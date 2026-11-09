"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import {
  DsButton,
  DsEmptyState,
  DsField,
  DsInput,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsToolbar,
} from "@/components/ds";
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

const statusTabs = [
  { id: "NOT_DISPENSED", label: "Chờ cấp" },
  { id: "DISPENSED", label: "Đã cấp" },
];

// Hàng đợi cấp thuốc: danh sách đơn bên trái, chọn một đơn thì khung kiểm tra và cấp mở cạnh danh sách.
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

  const pickedMedicineId = (item: PrescriptionItem) => (item.id in picks ? picks[item.id] : (item.medicineId ?? OUTSIDE));

  // Cộng dồn số cần cấp theo từng thuốc kho, để cảnh báo cả khi nhiều dòng cùng lấy một thuốc.
  const neededByMedicine = (prescription: QueuePrescription, medicineId: string) =>
    prescription.items.filter((other) => pickedMedicineId(other) === medicineId).reduce((sum, other) => sum + (other.quantity || 0), 0);

  const stockWarnings = selected
    ? selected.items.flatMap((item) => {
        const medicineId = pickedMedicineId(item);
        if (!medicineId) return [];
        const medicine = medicines.find((entry) => entry.id === medicineId);
        if (!medicine) return [];
        const needed = neededByMedicine(selected, medicineId);
        return needed > medicine.stockQuantity ? [`${medicine.name}: cần ${needed}, tồn ${medicine.stockQuantity}`] : [];
      })
    : [];
  const uniqueWarnings = Array.from(new Set(stockWarnings));

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

  const queue = queueQuery.data?.items ?? [];
  const errorMessage = dispenseMutation.error instanceof Error ? dispenseMutation.error.message : "";
  const queueError = queueQuery.error ? (queueQuery.error instanceof Error ? queueQuery.error.message : "Không tải được hàng đợi") : "";

  const blockReason = !confirmed
    ? "Tick xác nhận đã kiểm tra đơn trước khi cấp"
    : uniqueWarnings.length > 0
      ? "Có thuốc không đủ tồn kho"
      : "";

  const list = (
    <DsPanel flush>
      <form onSubmit={applySearch} aria-label="Tìm đơn cần cấp">
        <DsToolbar>
          <div style={{ minWidth: 160, flex: "1 1 200px" }}>
            <DsInput aria-label="Tìm đơn" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mã đơn, tên hoặc SĐT người khám" />
          </div>
          <DsButton type="submit">
            <Search aria-hidden="true" />
            Tìm
          </DsButton>
        </DsToolbar>
      </form>
      <DsTabs
        label="Trạng thái cấp thuốc"
        items={statusTabs}
        value={status}
        onChange={(id) => {
          setStatus(id as "NOT_DISPENSED" | "DISPENSED");
          setSelectedId(null);
        }}
      />
      {queueError ? <DsNotice tone="bad">{queueError}</DsNotice> : null}
      {queueQuery.isLoading ? <p style={{ margin: 0, padding: 16, color: "var(--ds-muted)" }}>Đang tải...</p> : null}
      {queueQuery.data && queue.length === 0 ? (
        <DsEmptyState
          title={status === "NOT_DISPENSED" ? "Không có đơn chờ cấp" : "Chưa có đơn đã cấp"}
          description="Đơn xuất hiện ở đây sau khi bác sĩ phát hành."
        />
      ) : null}
      <div role="listbox" aria-label="Danh sách đơn thuốc">
        {queue.map((item) => (
          <button key={item.id} type="button" role="option" className="ds-listrow" aria-selected={item.id === selectedId} onClick={() => select(item.id)}>
            <span className="ds-listrow__main">
              <strong>{item.patient.fullName}</strong>
              <small>
                {item.prescriptionCode} · {item.items.length} dòng · {item.issuedAt ? formatVietnamDateTime(item.issuedAt) : "—"}
              </small>
            </span>
            {item.appointment.allergies ? <DsStatusPill tone="warn">Dị ứng</DsStatusPill> : null}
          </button>
        ))}
      </div>
    </DsPanel>
  );

  const pane = selected ? (
    <DsPane
      wide
      bodyClassName="ds-pane__body ds-pane__body--flush"
      title={`${selected.prescriptionCode} · ${selected.patient.fullName}`}
      badge={
        <DsStatusPill tone={selected.dispenseStatus === "DISPENSED" ? "good" : "warn"}>
          {selected.dispenseStatus === "DISPENSED" ? "Đã cấp" : "Chờ cấp"}
        </DsStatusPill>
      }
      onClose={() => setSelectedId(null)}
    >
      <div style={{ padding: "12px 16px 0", color: "var(--ds-muted)", fontSize: 13 }}>
        {selected.patient.phone || "-"} · lịch {selected.appointment.bookingCode} · {[selected.doctor.title, selected.doctor.user.fullName].filter(Boolean).join(" ")}
        {selected.note ? ` · ghi chú bác sĩ: ${selected.note}` : ""}
      </div>

      {selected.appointment.allergies ? (
        <div style={{ padding: "12px 16px 0" }}>
          <DsNotice tone="warn">
            <strong>Dị ứng đã khai báo:</strong> {selected.appointment.allergies}
          </DsNotice>
        </div>
      ) : null}

      <div className="ds-editor">
        <div className="ds-editor__col">
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Thuốc trong đơn ({selected.items.length})</h3>
            </div>
            {selected.items.map((item) => {
              const medicineId = pickedMedicineId(item);
              const medicine = medicines.find((entry) => entry.id === medicineId);
              const short = medicine ? neededByMedicine(selected, medicineId) > medicine.stockQuantity : false;
              return (
                <div key={item.id} className="ds-labrow" style={{ display: "block" }}>
                  <div className="ds-labrow__main">
                    <strong>
                      {item.medicineName}
                      <span style={{ fontWeight: 400, color: "var(--ds-muted)" }}>
                        {" "}
                        · SL {item.quantity ?? "—"} {item.unit || ""}
                      </span>
                    </strong>
                    <small>{[item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ") || "Chưa có liều dùng"}</small>
                    {item.instruction ? <small>{item.instruction}</small> : null}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {selected.dispenseStatus === "DISPENSED" ? (
                      <small style={{ color: "var(--ds-muted)" }}>
                        {item.medicine ? `Đã cấp ${item.dispensedQuantity} · ${item.medicine.name}` : "Thuốc mua ngoài"}
                      </small>
                    ) : (
                      <DsField label="Thuốc trong kho" htmlFor={`pick-${item.id}`} hint={short ? undefined : medicine ? `Tồn ${medicine.stockQuantity} ${medicine.unit}` : undefined}>
                        <DsSelect
                          id={`pick-${item.id}`}
                          value={medicineId}
                          disabled={!canDispense}
                          onChange={(event) => setPicks((current) => ({ ...current, [item.id]: event.target.value }))}
                        >
                          <option value={OUTSIDE}>Thuốc mua ngoài (không trừ kho)</option>
                          {medicines.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name} — tồn {entry.stockQuantity} {entry.unit}
                            </option>
                          ))}
                        </DsSelect>
                        {short && medicine ? (
                          <span style={{ color: "var(--ds-bad)", fontSize: 12 }}>
                            Không đủ: cần {neededByMedicine(selected, medicineId)}, tồn {medicine.stockQuantity}
                          </span>
                        ) : null}
                      </DsField>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ds-editor__col">
          {selected.dispenseStatus === "DISPENSED" ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>Đã cấp thuốc</h3>
              </div>
              <div className="ds-card__body">
                <p style={{ margin: 0 }}>
                  {selected.dispensedAt ? formatVietnamDateTime(selected.dispensedAt) : "—"}
                  {selected.dispensedBy ? ` · bởi ${selected.dispensedBy.fullName}` : ""}
                </p>
                {selected.dispenseNote ? <p style={{ margin: 0, color: "var(--ds-muted)" }}>{selected.dispenseNote}</p> : null}
              </div>
            </div>
          ) : canDispense ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>Cấp thuốc</h3>
              </div>
              <div className="ds-card__body">
                {uniqueWarnings.length > 0 ? (
                  <DsNotice tone="bad">Không đủ tồn kho: {uniqueWarnings.join("; ")}. Nhập thêm thuốc hoặc đổi thuốc trước khi cấp.</DsNotice>
                ) : null}
                <DsField label="Ghi chú cấp thuốc (không bắt buộc)" htmlFor="dispense-note">
                  <DsInput id="dispense-note" value={note} onChange={(event) => setNote(event.target.value)} />
                </DsField>
                <label className="ds-check" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} style={{ marginTop: 3 }} />
                  <span>Tôi đã kiểm tra đơn: dị ứng, liều dùng và thuốc được chọn đúng với đơn của bác sĩ.</span>
                </label>
                <DsButton variant="primary" disabled={Boolean(blockReason) || dispenseMutation.isPending} onClick={() => dispenseMutation.mutate()}>
                  {dispenseMutation.isPending ? "Đang cấp..." : "Cấp thuốc cho cả đơn"}
                </DsButton>
                {blockReason ? <p className="ds-hint" style={{ margin: 0 }}>{blockReason}.</p> : null}
                <p className="ds-hint" style={{ margin: 0 }}>Kho chỉ bị trừ khi toàn bộ đơn đủ thuốc.</p>
              </div>
            </div>
          ) : (
            <DsNotice tone="info">Tài khoản chỉ được xem hàng đợi, chưa có quyền cấp thuốc.</DsNotice>
          )}
        </div>
      </div>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader
        title="Cấp thuốc theo đơn"
        description="Kiểm tra đơn, chọn thuốc trong kho cho từng dòng rồi cấp nguyên đơn."
        actions={
          <DsButton onClick={() => void queueQuery.refetch()}>
            <RefreshCw aria-hidden="true" className={queueQuery.isFetching ? "animate-spin" : undefined} />
            Làm mới
          </DsButton>
        }
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {errorMessage ? <DsNotice tone="bad">{errorMessage}</DsNotice> : null}
        {dispenseMutation.isSuccess ? <DsNotice tone="good">Đã cấp thuốc và trừ kho</DsNotice> : null}
      </div>
      <DsSplit wide list={list} pane={pane} />
    </>
  );
}
