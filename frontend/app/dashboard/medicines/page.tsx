"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsField,
  DsInput,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsToolbar,
  type DsColumn,
} from "@/components/ds";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { ImportCsvPanel } from "@/components/dashboard/import-csv-panel";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date";
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
  /** Tồn cấp được (không tính lô đã hết hạn). */
  sellableQuantity: number;
  expiredQuantity: number;
  nearestExpiry: string | null;
};

type Batch = {
  id: string;
  batchNumber: string;
  expiryDate: string;
  receivedQuantity: number;
  quantity: number;
  status: "EXPIRED" | "EXPIRING" | "OK";
  daysLeft: number;
};

type BatchList = {
  items: Batch[];
  summary: { stockQuantity: number; sellableQuantity: number; unbatchedQuantity: number };
};

type Movement = {
  id: string;
  type: "RECEIPT" | "DISPENSE" | "ADJUSTMENT";
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
  batch: { id: string; batchNumber: string; expiryDate: string } | null;
  actor: { fullName: string };
  prescriptionItem: { prescription: { prescriptionCode: string } } | null;
};

type Paged<T> = { items: T[]; pagination: { total: number; totalPages?: number } };

const PAGE_SIZE = 30;

const batchTone = { EXPIRED: "bad", EXPIRING: "warn", OK: "good" } as const;
const batchLabel = { EXPIRED: "Hết hạn", EXPIRING: "Sắp hết hạn", OK: "Còn hạn" } as const;
const isoToDate = (iso: string) => formatVietnamDate(`${iso}T00:00:00+07:00`);

const movementLabel = { RECEIPT: "Nhập kho", DISPENSE: "Cấp phát", ADJUSTMENT: "Điều chỉnh" } as const;
// Tệp mẫu cho nhập CSV: đúng tiêu đề cột mà máy chủ yêu cầu.
const CATALOG_TEMPLATE =
  "Mã thuốc,Tên thuốc,Đơn vị,Hoạt chất,Hàm lượng,Dạng bào chế,Mức tối thiểu,Ghi chú\r\nPARA500,Paracetamol 500mg,viên,Paracetamol,500mg,Viên nén,100,\r\n";
const RECEIPT_TEMPLATE = "Mã thuốc,Số lượng,Lý do\r\nPARA500,200,Phiếu nhập 01\r\n";
const emptyForm = { code: "", name: "", unit: "viên", strength: "", dosageForm: "", activeIngredient: "", minStock: "0" };

const stockTabs = [
  { id: "all", label: "Tất cả" },
  { id: "low", label: "Sắp hết" },
];

const formFields = [
  ["code", "Mã thuốc", true],
  ["name", "Tên thuốc", true],
  ["unit", "Đơn vị", true],
  ["strength", "Hàm lượng", false],
  ["dosageForm", "Dạng bào chế", false],
  ["activeIngredient", "Hoạt chất", false],
  ["minStock", "Mức tồn tối thiểu", false],
] as const;

// Kho thuốc: danh sách bên trái; chọn một thuốc thì khung bên phải cho nhập kho, điều chỉnh và xem sổ kho.
// Thêm thuốc vào danh mục mở ở cùng khung đó, không chiếm chỗ cố định.
export default function MedicinesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canCatalog = can(user, "pharmacy.catalog");
  const canReceive = can(user, "pharmacy.receive");
  const canAdjust = can(user, "pharmacy.adjust");

  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [receiptQty, setReceiptQty] = useState("");
  const [receiptBatch, setReceiptBatch] = useState("");
  const [receiptExpiry, setReceiptExpiry] = useState("");
  const [writeOffTarget, setWriteOffTarget] = useState<Batch | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const listQuery = useQuery({
    queryKey: ["dashboard", "pharmacy", "medicines", applied, lowOnly, page],
    queryFn: () =>
      apiRequest<Paged<Medicine>>("/dashboard/pharmacy/medicines", {
        query: { q: applied || undefined, lowStock: lowOnly ? "true" : undefined, page, limit: PAGE_SIZE },
      }),
  });
  const items = listQuery.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId) || null;
  const movementsQuery = useQuery({
    queryKey: ["dashboard", "pharmacy", "movements", selectedId],
    queryFn: () => apiRequest<Paged<Movement>>(`/dashboard/pharmacy/medicines/${selectedId}/movements`, { query: { limit: 30 } }),
    enabled: Boolean(selectedId),
  });

  const batchesQuery = useQuery({
    queryKey: ["dashboard", "pharmacy", "batches", selectedId],
    queryFn: () => apiRequest<BatchList>(`/dashboard/pharmacy/medicines/${selectedId}/batches`),
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
      setCreating(false);
      await refresh();
    },
  });
  const receiveMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/dashboard/pharmacy/medicines/${selectedId}/receipts`, {
        method: "POST",
        body: {
          quantity: Number(receiptQty),
          reason: "Nhập kho",
          batchNumber: receiptBatch.trim() || null,
          expiryDate: receiptExpiry || null,
        },
      }),
    onSuccess: async () => {
      setReceiptQty("");
      setReceiptBatch("");
      setReceiptExpiry("");
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

  // Huỷ cả số còn lại của một lô (hết hạn hoặc hỏng): ghi vào sổ kho như một điều chỉnh theo lô.
  const writeOffMutation = useMutation({
    mutationFn: (batch: Batch) =>
      apiRequest(`/dashboard/pharmacy/medicines/${selectedId}/adjustments`, {
        method: "POST",
        body: {
          delta: -batch.quantity,
          reason: batch.status === "EXPIRED" ? "Huỷ thuốc hết hạn" : "Huỷ thuốc theo lô",
          batchId: batch.id,
        },
      }),
    onSuccess: async () => {
      setWriteOffTarget(null);
      await refresh();
    },
  });

  const mutations = [createMutation, receiveMutation, adjustMutation, writeOffMutation];
  const failed = mutations.find((item) => item.error instanceof Error)?.error as Error | undefined;
  const succeeded = mutations.some((item) => item.isSuccess);
  const submit = (action: () => void) => (event: FormEvent) => {
    event.preventDefault();
    action();
  };

  const resetMutations = () => mutations.forEach((item) => item.reset());

  // Thông báo thành công tự tắt sau vài giây, giống các trang khác.
  useEffect(() => {
    if (!succeeded) return;
    const timeoutId = window.setTimeout(() => {
      createMutation.reset();
      receiveMutation.reset();
      adjustMutation.reset();
      writeOffMutation.reset();
    }, 4500);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  const totalPages = listQuery.data?.pagination.totalPages ?? 1;
  const selectMedicine = (id: string) => {
    resetMutations();
    setCreating(false);
    setWriteOffTarget(null);
    setReceiptBatch("");
    setReceiptExpiry("");
    setSelectedId(id);
  };
  const closePane = () => {
    setSelectedId(null);
    setCreating(false);
  };

  const open = Boolean(selected) || creating;

  const columns: DsColumn<Medicine>[] = [
    {
      key: "name",
      header: "Thuốc",
      cell: (item) => (
        <div>
          <strong>
            {item.name} {item.strength || ""}
          </strong>
          {!item.isActive ? <span style={{ marginLeft: 8, color: "var(--ds-muted)", fontSize: 12 }}>(ngừng dùng)</span> : null}
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
            <span className="ds-mono">{item.code}</span>
            {item.dosageForm ? ` · ${item.dosageForm}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Tồn cấp được",
      align: "num",
      cell: (item) => {
        const low = item.sellableQuantity <= item.minStock;
        return (
          <div>
            <strong style={low ? { color: "var(--ds-bad)" } : undefined}>
              {item.sellableQuantity} {item.unit}
            </strong>
            {low ? <div style={{ fontSize: 12, color: "var(--ds-bad)" }}>Sắp hết (tối thiểu {item.minStock})</div> : null}
            {item.expiredQuantity > 0 ? <div style={{ fontSize: 12, color: "var(--ds-bad)" }}>{item.expiredQuantity} đã hết hạn</div> : null}
            {item.nearestExpiry ? <div style={{ fontSize: 12, color: "var(--ds-muted)" }}>Hạn gần nhất {isoToDate(item.nearestExpiry)}</div> : null}
          </div>
        );
      },
    },
  ];

  const list = (
    <DsPanel flush>
      <form onSubmit={submit(() => {
        setApplied(search.trim());
        setPage(1);
      })} aria-label="Tìm thuốc">
        <DsToolbar>
          <div style={{ minWidth: 160, flex: "1 1 200px" }}>
            <DsInput aria-label="Tìm thuốc" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, mã hoặc hoạt chất" />
          </div>
          <DsButton type="submit">
            <Search aria-hidden="true" />
            Tìm
          </DsButton>
          {canCatalog ? (
            <DsButton
              variant="primary"
              onClick={() => {
                resetMutations();
                setSelectedId(null);
                setCreating(true);
              }}
            >
              <Plus aria-hidden="true" />
              Thêm thuốc
            </DsButton>
          ) : null}
        </DsToolbar>
      </form>
      <DsTabs label="Lọc theo tồn kho" items={stockTabs} value={lowOnly ? "low" : "all"} onChange={(id) => {
          setLowOnly(id === "low");
          setPage(1);
        }}
      />
      {open ? (
        items.length ? (
          <div role="listbox" aria-label="Danh sách thuốc">
            {items.map((item) => {
              const low = item.stockQuantity <= item.minStock;
              return (
                <button key={item.id} type="button" role="option" className="ds-listrow" aria-selected={item.id === selectedId} onClick={() => selectMedicine(item.id)}>
                  <span className="ds-listrow__main">
                    <strong>
                      {item.name} {item.strength || ""}
                    </strong>
                    <small>{item.code}</small>
                  </span>
                  <DsStatusPill tone={low || item.expiredQuantity > 0 ? "bad" : "neutral"}>
                    {item.sellableQuantity} {item.unit}
                  </DsStatusPill>
                </button>
              );
            })}
          </div>
        ) : (
          <DsEmptyState title="Chưa có thuốc" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách thuốc"
          columns={columns}
          rows={items}
          rowKey={(item) => item.id}
          loading={listQuery.isLoading}
          emptyTitle="Chưa có thuốc"
          emptyDescription="Thêm thuốc vào danh mục rồi nhập kho."
          onRowClick={(item) => selectMedicine(item.id)}
        />
      )}
      {totalPages > 1 ? (
        <div className="ds-pager">
          <span>
            {listQuery.data?.pagination.total ?? 0} thuốc · trang {page}/{totalPages}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <DsButton disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
              Trước
            </DsButton>
            <DsButton disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
              Sau
            </DsButton>
          </span>
        </div>
      ) : null}
    </DsPanel>
  );

  const createPane = creating ? (
    <DsPane title="Thêm thuốc vào danh mục" onClose={closePane}>
      <form onSubmit={submit(() => createMutation.mutate())} style={{ display: "grid", gap: 12 }} aria-label="Thêm thuốc">
        <div className="ds-grid-fields">
          {formFields.map(([key, label, required]) => (
            <DsField key={key} label={label} htmlFor={`med-${key}`} required={required}>
              <DsInput id={`med-${key}`} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
            </DsField>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <DsButton onClick={closePane}>Hủy</DsButton>
          <DsButton type="submit" variant="primary" disabled={!form.code.trim() || !form.name.trim() || !form.unit.trim() || createMutation.isPending}>
            Thêm thuốc
          </DsButton>
        </div>
      </form>
    </DsPane>
  ) : null;

  const adjustBlock = !adjustDelta || Number(adjustDelta) === 0 ? "Nhập số lượng khác 0" : !adjustReason.trim() ? "Cần ghi lý do điều chỉnh" : "";

  const detailPane = selected ? (
    <DsPane
      wide
      bodyClassName="ds-pane__body ds-pane__body--flush"
      title={`${selected.name} ${selected.strength || ""}`.trim()}
      badge={
        <DsStatusPill tone={selected.sellableQuantity <= selected.minStock ? "bad" : "good"}>
          Cấp được {selected.sellableQuantity} {selected.unit}
        </DsStatusPill>
      }
      onClose={closePane}
    >
      <div style={{ padding: "12px 16px 0", color: "var(--ds-muted)", fontSize: 13 }}>
        {selected.code}
        {selected.dosageForm ? ` · ${selected.dosageForm}` : ""}
        {selected.activeIngredient ? ` · ${selected.activeIngredient}` : ""} · mức tối thiểu {selected.minStock}
      </div>

      <div className="ds-editor">
        <div className="ds-editor__col">
          {canReceive ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>Nhập kho</h3>
              </div>
              <form className="ds-card__body" onSubmit={submit(() => receiveMutation.mutate())} aria-label="Nhập kho">
                <DsField label={`Số lượng (${selected.unit})`} htmlFor="receipt-qty">
                  <DsInput id="receipt-qty" type="number" min={1} value={receiptQty} onChange={(event) => setReceiptQty(event.target.value)} />
                </DsField>
                <div className="ds-grid-fields">
                  <DsField label="Số lô" htmlFor="receipt-batch" hint="Khai cùng hạn dùng để theo dõi lô">
                    <DsInput id="receipt-batch" value={receiptBatch} onChange={(event) => setReceiptBatch(event.target.value)} />
                  </DsField>
                  <DsField label="Hạn dùng" htmlFor="receipt-expiry">
                    <VietnamDateInput value={receiptExpiry} onChange={setReceiptExpiry} ariaLabel="Hạn dùng" className="ds-input" />
                  </DsField>
                </div>
                {Boolean(receiptBatch.trim()) !== Boolean(receiptExpiry) ? <p className="ds-hint" style={{ margin: 0 }}>Cần khai cả số lô và hạn dùng, hoặc bỏ trống cả hai.</p> : null}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <DsButton
                    type="submit"
                    variant="primary"
                    disabled={!receiptQty || Boolean(receiptBatch.trim()) !== Boolean(receiptExpiry) || receiveMutation.isPending}
                  >
                    Nhập kho
                  </DsButton>
                </div>
              </form>
            </div>
          ) : null}

          {canAdjust ? (
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>Điều chỉnh tồn</h3>
              </div>
              <form className="ds-card__body" onSubmit={submit(() => adjustMutation.mutate())} aria-label="Điều chỉnh tồn">
                <p className="ds-hint" style={{ margin: 0 }}>
                  Dùng khi kiểm kê hoặc huỷ thuốc hỏng. Số âm để trừ, số dương để cộng.
                </p>
                <div className="ds-grid-fields">
                  <DsField label="Thay đổi (±)" htmlFor="adjust-delta">
                    <DsInput id="adjust-delta" type="number" value={adjustDelta} onChange={(event) => setAdjustDelta(event.target.value)} />
                  </DsField>
                  <DsField label="Lý do" htmlFor="adjust-reason" required>
                    <DsInput id="adjust-reason" value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} />
                  </DsField>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                  {adjustDelta || adjustReason ? <span className="ds-hint">{adjustBlock}</span> : null}
                  <DsButton type="submit" disabled={Boolean(adjustBlock) || adjustMutation.isPending}>
                    Điều chỉnh
                  </DsButton>
                </div>
              </form>
            </div>
          ) : null}
        </div>

        <div className="ds-editor__col">
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Lô thuốc</h3>
              {batchesQuery.data ? (
                <small style={{ color: "var(--ds-muted)" }}>
                  Cấp được {batchesQuery.data.summary.sellableQuantity} · chưa gắn lô {batchesQuery.data.summary.unbatchedQuantity}
                </small>
              ) : null}
            </div>
            {batchesQuery.data && batchesQuery.data.items.length === 0 ? (
              <p style={{ margin: 0, padding: 14, color: "var(--ds-muted)" }}>Chưa có lô nào được khai. Nhập kho kèm số lô và hạn dùng để theo dõi.</p>
            ) : null}
            {batchesQuery.data?.items.map((batch) => (
              <div key={batch.id} className="ds-labrow">
                <div className="ds-labrow__main">
                  <strong>
                    Lô {batch.batchNumber} · {batch.quantity} {selected.unit}
                  </strong>
                  <small>
                    Hạn {isoToDate(batch.expiryDate)}
                    {batch.status === "EXPIRED" ? ` · quá hạn ${-batch.daysLeft} ngày` : ` · còn ${batch.daysLeft} ngày`}
                  </small>
                  {writeOffTarget?.id === batch.id ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13 }}>Huỷ {batch.quantity} {selected.unit} còn lại của lô này?</span>
                      <DsButton variant="danger" disabled={writeOffMutation.isPending} onClick={() => writeOffMutation.mutate(batch)}>
                        Huỷ lô
                      </DsButton>
                      <DsButton onClick={() => setWriteOffTarget(null)}>Giữ lại</DsButton>
                    </div>
                  ) : null}
                </div>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <DsStatusPill tone={batchTone[batch.status]}>{batchLabel[batch.status]}</DsStatusPill>
                  {canAdjust && writeOffTarget?.id !== batch.id ? (
                    <DsButton variant="ghost" onClick={() => setWriteOffTarget(batch)}>
                      Huỷ lô
                    </DsButton>
                  ) : null}
                </span>
              </div>
            ))}
          </div>

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Sổ kho gần đây</h3>
            </div>
            {movementsQuery.data && movementsQuery.data.items.length === 0 ? (
              <p style={{ margin: 0, padding: 14, color: "var(--ds-muted)" }}>Chưa có biến động nào.</p>
            ) : null}
            {movementsQuery.data?.items.map((move) => (
              <div key={move.id} className="ds-labrow">
                <div className="ds-labrow__main">
                  <strong>
                    {movementLabel[move.type]}
                    {move.prescriptionItem ? ` · đơn ${move.prescriptionItem.prescription.prescriptionCode}` : ""}
                    {move.batch ? ` · lô ${move.batch.batchNumber}` : ""}
                  </strong>
                  {move.reason ? <small>{move.reason}</small> : null}
                  <small>
                    {formatVietnamDateTime(move.createdAt)} · {move.actor.fullName}
                  </small>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <strong style={{ color: move.quantity > 0 ? "var(--ds-good)" : "var(--ds-bad)" }}>
                    {move.quantity > 0 ? "+" : ""}
                    {move.quantity}
                  </strong>
                  <div style={{ fontSize: 12, color: "var(--ds-muted)" }}>còn {move.balanceAfter}</div>
                </div>
              </div>
            ))}
            <p className="ds-hint" style={{ margin: 0, padding: "10px 14px" }}>
              Sổ kho không sửa hay xoá được.
            </p>
          </div>
        </div>
      </div>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader
        title="Kho thuốc"
        description="Tồn chỉ thay đổi qua phiếu nhập, cấp thuốc theo đơn hoặc điều chỉnh có lý do."
        actions={
          <>
            <ExportCsvButton ds path="/dashboard/pharmacy/medicines/export" fallbackName="ton-kho-thuoc.csv" ranged={false} label="Xuất tồn kho" />
            <ExportCsvButton ds path="/dashboard/pharmacy/movements/export" fallbackName="so-kho-thuoc.csv" label="Xuất sổ kho" />
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
            <DsButton onClick={() => void listQuery.refetch()}>
              <RefreshCw aria-hidden="true" className={listQuery.isFetching ? "animate-spin" : undefined} />
              Làm mới
            </DsButton>
          </>
        }
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {failed ? <DsNotice tone="bad">{failed.message}</DsNotice> : null}
        {succeeded && !failed ? <DsNotice tone="good">Đã lưu thay đổi kho</DsNotice> : null}
      </div>
      <DsSplit wide list={list} pane={detailPane ?? createPane} />
    </>
  );
}
