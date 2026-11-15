"use client";

import { FormEvent, useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
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
import { ApiError, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatVietnamDateTime } from "@/lib/date";
import { useDebouncedValue } from "@/lib/use-debounced-value";

import { can } from "@/lib/permissions";

type StockMedicine = { id: string; code: string; name: string; unit: string; stockQuantity: number; sellableQuantity?: number; expiredQuantity?: number };

// Tồn cấp được: không tính lô đã hết hạn (máy chủ không cho cấp từ lô hết hạn).
const availableOf = (medicine: StockMedicine) => medicine.sellableQuantity ?? medicine.stockQuantity;

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
  fulfillmentStatus: "PENDING" | "DISPENSED" | "OUTSIDE" | "OUT_OF_STOCK";
  fulfillmentNote: string | null;
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
  appointment: {
    bookingCode: string;
    allergies: string | null;
    invoice: { invoiceCode: string; status: "UNPAID" | "PAID" | "CANCELLED" | "REFUNDED"; paymentMethod: string | null } | null;
  };
  dispensedBy: { fullName: string } | null;
  items: PrescriptionItem[];
};

type Paged<T> = { items: T[]; pagination: { total: number; totalPages?: number } };

const OUTSIDE = "";
// Giá trị riêng của ô chọn: kho hết thuốc này nên không cấp (người khám mua ngoài); không phải mã thuốc.
const OUT_OF_STOCK = "__out_of_stock__";
const QUEUE_PAGE_SIZE = 20;

const normalizeName = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Gợi ý thuốc kho khi dòng đơn chưa gắn sẵn: tên thuốc trong kho nằm trong tên ở đơn (hoặc ngược lại); lấy tên dài nhất.
const suggestMedicine = (itemName: string, medicines: StockMedicine[]) => {
  const target = normalizeName(itemName);
  if (!target) return null;
  let best: StockMedicine | null = null;
  for (const medicine of medicines) {
    const name = normalizeName(medicine.name);
    if (!name) continue;
    if ((target.includes(name) || name.includes(target)) && (!best || name.length > normalizeName(best.name).length)) best = medicine;
  }
  return best;
};

// Tình trạng thanh toán của lịch khám chứa đơn: chỉ để dược sĩ nắm; chưa chặn cấp thuốc ở máy chủ.
const paymentInfo = (invoice: QueuePrescription["appointment"]["invoice"]) => {
  if (!invoice) return { label: "Chưa có hóa đơn", tone: "warn" as const, paid: false };
  if (invoice.status === "PAID") return { label: "Đã thanh toán", tone: "good" as const, paid: true };
  if (invoice.status === "UNPAID") return { label: "Chưa thanh toán", tone: "warn" as const, paid: false };
  return { label: invoice.status === "REFUNDED" ? "Đã hoàn tiền" : "Hóa đơn đã hủy", tone: "bad" as const, paid: false };
};

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
  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const appliedSearch = useDebouncedValue(search.trim());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Lựa chọn thuốc kho của dược sĩ theo từng dòng; dòng chưa chọn dùng thuốc đã gắn sẵn.
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  // Lý do cấp thuốc khi hóa đơn chưa thanh toán hoặc chưa tính tiền thuốc này (máy chủ bắt buộc, lưu vào nhật ký cấp thuốc).
  const [unpaidReason, setUnpaidReason] = useState("");
  // Máy chủ vừa từ chối vì thanh toán: mở ô lý do ngay cả khi giao diện thấy hóa đơn đã trả (chưa tính thuốc này).
  const [paymentRejected, setPaymentRejected] = useState(false);
  const [note, setNote] = useState("");

  const queueQuery = useQuery({
    queryKey: ["dashboard", "pharmacy", "queue", status, appliedSearch, page],
    queryFn: () =>
      apiRequest<Paged<QueuePrescription>>("/dashboard/pharmacy/prescriptions", {
        query: { dispenseStatus: status, q: appliedSearch || undefined, page, limit: QUEUE_PAGE_SIZE },
      }),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  // Máy chủ trả tối đa 100 thuốc mỗi trang; lấy lần lượt các trang để ô chọn thuốc luôn đủ cả kho.
  const medicinesQuery = useQuery({
    queryKey: ["dashboard", "pharmacy", "medicine-options"],
    queryFn: async () => {
      const items: StockMedicine[] = [];
      for (let current = 1; current <= 20; current += 1) {
        const result = await apiRequest<Paged<StockMedicine> & { pagination: { totalPages?: number } }>("/dashboard/pharmacy/medicines", {
          query: { isActive: "true", page: current, limit: 100 },
        });
        items.push(...result.items);
        if (current >= (result.pagination.totalPages ?? 1)) break;
      }
      return { items, pagination: { total: items.length } } as Paged<StockMedicine>;
    },
    staleTime: 15_000,
  });

  const selected = queueQuery.data?.items.find((item) => item.id === selectedId) || null;
  const medicines = medicinesQuery.data?.items || [];

  // Dòng đơn chưa gắn thuốc kho thì gợi ý theo tên; dược sĩ vẫn phải kiểm tra lại trước khi cấp.
  const suggestedFor = (item: PrescriptionItem) => (item.medicineId ? null : suggestMedicine(item.medicineName, medicines));
  const pickedMedicineId = (item: PrescriptionItem) => (item.id in picks ? picks[item.id] : (item.medicineId ?? suggestedFor(item)?.id ?? OUTSIDE));

  // Cộng dồn số cần cấp theo từng thuốc kho, để cảnh báo cả khi nhiều dòng cùng lấy một thuốc.
  const neededByMedicine = (prescription: QueuePrescription, medicineId: string) =>
    prescription.items.filter((other) => pickedMedicineId(other) === medicineId).reduce((sum, other) => sum + (other.quantity || 0), 0);

  const stockWarnings = selected
    ? selected.items.flatMap((item) => {
        const medicineId = pickedMedicineId(item);
        if (!medicineId || medicineId === OUT_OF_STOCK) return [];
        const medicine = medicines.find((entry) => entry.id === medicineId);
        if (!medicine) return [];
        const needed = neededByMedicine(selected, medicineId);
        return needed > availableOf(medicine) ? [`${medicine.name}: cần ${needed}, còn hạn ${availableOf(medicine)}`] : [];
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
          unpaidReason: needsPaymentReason ? unpaidReason.trim() : undefined,
          lines: selected!.items.map((item) => {
            const picked = pickedMedicineId(item);
            return {
              itemId: item.id,
              medicineId: picked === OUT_OF_STOCK ? null : picked || null,
              action: picked === OUT_OF_STOCK ? "OUT_OF_STOCK" : picked === OUTSIDE ? "OUTSIDE" : "DISPENSE",
            };
          }),
        },
      }),
    onSuccess: async () => {
      setSelectedId(null);
      setPicks({});
      setConfirmed(false);
      setUnpaidReason("");
      setPaymentRejected(false);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "pharmacy"] });
    },
    onError: (error) => {
      setPaymentRejected(error instanceof ApiError && error.status === 409 && /thanh toán|hóa đơn/i.test(error.message));
    },
  });

  const select = (id: string) => {
    setSelectedId(id);
    setPicks({});
    setConfirmed(false);
    setUnpaidReason("");
    setPaymentRejected(false);
    setNote("");
    dispenseMutation.reset();
  };
  const applySearch = (event: FormEvent) => event.preventDefault();

  const queue = queueQuery.data?.items ?? [];
  const queuePagination = queueQuery.data?.pagination;
  const queueTotalPages = queuePagination?.totalPages ?? 1;

  // Thông báo thành công tự tắt sau vài giây, giống các trang khác.
  const resetDispense = dispenseMutation.reset;
  useEffect(() => {
    if (!dispenseMutation.isSuccess) return;
    const timeoutId = window.setTimeout(() => resetDispense(), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [dispenseMutation.isSuccess, resetDispense]);
  const errorMessage = dispenseMutation.error instanceof Error ? dispenseMutation.error.message : "";
  const queueError = queueQuery.error ? (queueQuery.error instanceof Error ? queueQuery.error.message : "Không tải được hàng đợi") : "";

  const selectedPayment = selected ? paymentInfo(selected.appointment.invoice) : null;
  // Máy chủ chặn cấp thuốc khi hóa đơn chưa thanh toán hoặc chưa tính tiền thuốc, trừ khi có lý do. Hóa đơn đã
  // thanh toán nhưng chưa tính thuốc này chỉ lộ ra khi máy chủ từ chối, nên cũng mở ô lý do theo lỗi đó.
  const needsPaymentReason = Boolean((selectedPayment && !selectedPayment.paid) || paymentRejected);
  const blockReason = !confirmed
    ? "Tick xác nhận đã kiểm tra đơn trước khi cấp"
    : needsPaymentReason && unpaidReason.trim().length < 5
      ? "Chưa thu tiền: nhập lý do cấp trước (ít nhất 5 ký tự)"
      : uniqueWarnings.length > 0
        ? "Có thuốc không đủ tồn kho"
        : "";

  const list = (
    <DsPanel flush>
      <form onSubmit={applySearch} aria-label="Tìm đơn cần cấp">
        <DsToolbar>
          <div style={{ minWidth: 160, flex: "1 1 200px" }}>
            <DsInput
              aria-label="Tìm đơn"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Gõ mã đơn, tên hoặc SĐT để lọc"
            />
          </div>
        </DsToolbar>
      </form>
      <DsTabs
        label="Trạng thái cấp thuốc"
        items={statusTabs}
        value={status}
        onChange={(id) => {
          setStatus(id as "NOT_DISPENSED" | "DISPENSED");
          setPage(1);
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
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <DsStatusPill tone={paymentInfo(item.appointment.invoice).tone}>{paymentInfo(item.appointment.invoice).label}</DsStatusPill>
              {item.appointment.allergies ? <DsStatusPill tone="warn">Dị ứng</DsStatusPill> : null}
            </span>
          </button>
        ))}
      </div>
      {queueTotalPages > 1 ? (
        <div className="ds-pager">
          <span>
            {queuePagination?.total ?? 0} đơn · trang {page}/{queueTotalPages}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <DsButton disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
              Trước
            </DsButton>
            <DsButton disabled={page >= queueTotalPages} onClick={() => setPage((current) => current + 1)}>
              Sau
            </DsButton>
          </span>
        </div>
      ) : null}
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

      {selectedPayment ? (
        <div style={{ padding: "12px 16px 0" }}>
          <DsNotice tone={selectedPayment.paid ? "good" : "warn"}>
            <strong>Thanh toán:</strong> {selectedPayment.label}
            {selected.appointment.invoice ? ` · hóa đơn ${selected.appointment.invoice.invoiceCode}` : ""}
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
              const short = medicine ? neededByMedicine(selected, medicineId) > availableOf(medicine) : false;
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
                        {item.fulfillmentStatus === "OUT_OF_STOCK"
                          ? `Kho hết thuốc, người khám mua ngoài${item.fulfillmentNote ? ` · ${item.fulfillmentNote}` : ""}`
                          : item.medicine && item.dispensedQuantity > 0
                            ? `Đã cấp ${item.dispensedQuantity} · ${item.medicine.name}`
                            : "Thuốc mua ngoài"}
                      </small>
                    ) : (
                      <DsField label="Thuốc trong kho" htmlFor={`pick-${item.id}`} hint={short ? undefined : medicine ? `${!item.medicineId && !(item.id in picks) ? "Gợi ý theo tên thuốc, kiểm tra lại. " : ""}Còn hạn ${availableOf(medicine)} ${medicine.unit}${medicine.expiredQuantity ? ` (đã loại ${medicine.expiredQuantity} hết hạn)` : ""}` : undefined}>
                        <DsSelect
                          id={`pick-${item.id}`}
                          value={medicineId}
                          disabled={!canDispense}
                          onChange={(event) => setPicks((current) => ({ ...current, [item.id]: event.target.value }))}
                        >
                          <option value={OUTSIDE}>Thuốc mua ngoài (không trừ kho)</option>
                          <option value={OUT_OF_STOCK}>Kho hết thuốc này (không cấp, người khám mua ngoài)</option>
                          {medicines.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name} — còn hạn {availableOf(entry)} {entry.unit}
                            </option>
                          ))}
                        </DsSelect>
                        {short && medicine ? (
                          <span style={{ color: "var(--ds-bad)", fontSize: 12 }}>
                            Không đủ: cần {neededByMedicine(selected, medicineId)}, còn hạn {availableOf(medicine)}
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
                {needsPaymentReason ? (
                  <DsField
                    label="Lý do cấp thuốc khi chưa thu tiền"
                    htmlFor="unpaid-reason"
                    required
                    hint={`Hóa đơn: ${selectedPayment?.label.toLowerCase() ?? "chưa tính tiền thuốc này"}. Lý do được lưu vào nhật ký cấp thuốc (ví dụ cấp cứu, quản lý đã duyệt).`}
                  >
                    <DsInput id="unpaid-reason" value={unpaidReason} onChange={(event) => setUnpaidReason(event.target.value)} />
                  </DsField>
                ) : null}
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
