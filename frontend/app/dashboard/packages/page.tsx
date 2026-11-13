"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsField,
  DsInput,
  DsKeyValue,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsTextarea,
  DsToolbar,
  type DsColumn,
} from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardDepartments } from "@/lib/dashboard-departments-query";
import { useDashboardPackages } from "@/lib/dashboard-packages-query";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { MedicalPackage, PackageItem } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Gói khám: danh sách bên trái; chọn một gói thì khung bên phải gom thông tin gói (trái) và các hạng mục cấu thành (phải).

type PackageForm = {
  name: string;
  slug: string;
  departmentId: string;
  basePrice: string;
  serviceFee: string;
  summary: string;
  description: string;
  note: string;
  isPopular: boolean;
  isBHYTSupport: boolean;
  isActive: boolean;
};

type ItemForm = {
  name: string;
  description: string;
  price: string;
  included: boolean;
  order: string;
};

const emptyPackageForm: PackageForm = {
  name: "",
  slug: "",
  departmentId: "",
  basePrice: "",
  serviceFee: "0",
  summary: "",
  description: "",
  note: "",
  isPopular: false,
  isBHYTSupport: false,
  isActive: true,
};

const emptyItemForm: ItemForm = { name: "", description: "", price: "0", included: true, order: "0" };

const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "true", label: "Đang hiển thị" },
  { id: "false", label: "Tạm ẩn" },
];

const createSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseMoneyInput = (value: string) => value.replace(/\D/g, "");

const formatMoneyInput = (value: string) => {
  const digits = parseMoneyInput(value);
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

const getIncludedItemsTotal = (items: PackageItem[]) => items.filter((item) => item.included).reduce((total, item) => total + item.price, 0);

const toPackageForm = (item: MedicalPackage): PackageForm => ({
  name: item.name,
  slug: item.slug || "",
  departmentId: item.departmentId || "",
  basePrice: String(item.basePrice),
  serviceFee: String(item.serviceFee || 0),
  summary: item.summary || "",
  description: item.description || "",
  note: item.note || "",
  isPopular: item.isPopular,
  isBHYTSupport: item.isBHYTSupport,
  isActive: item.isActive,
});

const toItemForm = (item: PackageItem): ItemForm => ({
  name: item.name,
  description: item.description || "",
  price: String(item.price || 0),
  included: item.included,
  order: String(item.order || 0),
});

const buildPackagePayload = (form: PackageForm) => ({
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  departmentId: form.departmentId || null,
  basePrice: Number(form.basePrice || 0),
  serviceFee: Number(form.serviceFee || 0),
  summary: form.summary.trim() || null,
  description: form.description.trim() || null,
  note: form.note.trim() || null,
  isPopular: form.isPopular,
  isBHYTSupport: form.isBHYTSupport,
  isActive: form.isActive,
});

const buildItemPayload = (form: ItemForm) => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  price: Number(form.price || 0),
  included: form.included,
  order: Number(form.order || 0),
});

type PaneState = { kind: "new" } | { kind: "edit"; id: string } | null;

export default function PackagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [popular, setPopular] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pane, setPane] = useState<PaneState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<PackageForm>(emptyPackageForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackageItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<PackageItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);

  const canWrite = can(user, "catalog.manage");
  const canDelete = can(user, "catalog.delete");

  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const term = useDebouncedValue(search.trim());
  const query = useMemo(() => ({ search: term || undefined, isActive: status || undefined, isPopular: popular || undefined, page, limit: 10 }), [page, popular, status, term]);
  const departmentQuery = useMemo(() => ({ isActive: "true", limit: 100 }), []);
  const packagesQuery = useDashboardPackages(query);
  const departmentsQuery = useDashboardDepartments(departmentQuery);
  const packages = packagesQuery.data?.items ?? [];
  const departments = departmentsQuery.data?.items ?? [];
  const pagination = packagesQuery.data?.pagination ?? { page, limit: 10, total: 0, totalPages: 1 };
  const queryError = packagesQuery.error || departmentsQuery.error;
  const queryErrorMessage = queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu gói khám") : "";
  const visibleError = error || queryErrorMessage;
  const selected = pane?.kind === "edit" ? packages.find((item) => item.id === pane.id) ?? null : null;
  const open = pane?.kind === "new" ? canWrite : pane?.kind === "edit" && Boolean(selected);

  const invalidatePackages = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "packages"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "packages"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicBootstrap() }),
    ]);
  };

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const resetItemEditor = () => {
    setItemOpen(false);
    setEditingItem(null);
    setDeleteItemTarget(null);
    setItemForm(emptyItemForm);
  };

  const startCreate = () => {
    setForm(emptyPackageForm);
    setSlugTouched(false);
    setConfirmDelete(false);
    resetItemEditor();
    setError("");
    setPane({ kind: "new" });
  };

  const openPackage = (item: MedicalPackage) => {
    setForm(toPackageForm(item));
    setSlugTouched(false);
    setConfirmDelete(false);
    resetItemEditor();
    setError("");
    setPane({ kind: "edit", id: item.id });
  };

  const closePane = () => {
    setPane(null);
    setConfirmDelete(false);
    resetItemEditor();
  };

  const handleNameChange = (name: string) => {
    setForm((current) => {
      const currentSlugWasAuto = !current.slug || current.slug === createSlug(current.name);
      return { ...current, name, slug: !slugTouched && currentSlugWasAuto ? createSlug(name) : current.slug };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (pane?.kind === "edit") {
        await apiRequest<MedicalPackage>(`/dashboard/packages/${pane.id}`, { method: "PATCH", body: buildPackagePayload(form) });
        setNotice("Đã cập nhật gói khám");
      } else {
        await apiRequest<MedicalPackage>("/dashboard/packages", { method: "POST", body: buildPackagePayload(form) });
        setNotice("Đã tạo gói khám");
        closePane();
      }
      await invalidatePackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được gói khám");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || !canDelete) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<MedicalPackage>(`/dashboard/packages/${selected.id}`, { method: "DELETE" });
      setNotice("Đã xóa gói khám");
      closePane();
      await invalidatePackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được gói khám");
    } finally {
      setSaving(false);
    }
  };

  const startAddItem = () => {
    setEditingItem(null);
    setDeleteItemTarget(null);
    setItemForm({ ...emptyItemForm, order: String(selected ? selected.items.length : 0) });
    setItemOpen(true);
  };

  const startEditItem = (item: PackageItem) => {
    setEditingItem(item);
    setDeleteItemTarget(null);
    setItemForm(toItemForm(item));
    setItemOpen(true);
  };

  const handleItemSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !selected) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingItem) {
        await apiRequest<PackageItem>(`/dashboard/packages/${selected.id}/items/${editingItem.id}`, { method: "PATCH", body: buildItemPayload(itemForm) });
        setNotice("Đã cập nhật hạng mục");
      } else {
        await apiRequest<PackageItem>(`/dashboard/packages/${selected.id}/items`, { method: "POST", body: buildItemPayload(itemForm) });
        setNotice("Đã tạo hạng mục");
      }
      resetItemEditor();
      await invalidatePackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được hạng mục");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!canWrite || !selected || !deleteItemTarget) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<PackageItem>(`/dashboard/packages/${selected.id}/items/${deleteItemTarget.id}`, { method: "DELETE" });
      setNotice("Đã xóa hạng mục");
      setDeleteItemTarget(null);
      await invalidatePackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được hạng mục");
    } finally {
      setSaving(false);
    }
  };

  const columns: DsColumn<MedicalPackage>[] = [
    {
      key: "name",
      header: "Gói khám",
      cell: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.summary || row.slug || "Chưa có tóm tắt"}</div>
        </div>
      ),
    },
    { key: "department", header: "Chuyên khoa", cell: (row) => row.department?.name || "Tất cả khoa" },
    {
      key: "price",
      header: "Giá",
      align: "num",
      cell: (row) => {
        const includedTotal = row.includedItemsTotal ?? getIncludedItemsTotal(row.items);
        return (
          <div>
            <strong>{formatCurrency(row.finalPrice)}</strong>
            <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
              Hạng mục {formatCurrency(includedTotal || row.basePrice)} + phí {formatCurrency(row.serviceFee)}
            </div>
          </div>
        );
      },
    },
    {
      key: "tags",
      header: "Nhãn",
      cell: (row) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {row.isPopular ? <DsStatusPill tone="warn">Nổi bật</DsStatusPill> : null}
          {row.isBHYTSupport ? <DsStatusPill tone="good">BHYT</DsStatusPill> : null}
          <DsStatusPill tone={row.isActive ? "good" : "neutral"}>{row.isActive ? "Hiển thị" : "Tạm ẩn"}</DsStatusPill>
        </div>
      ),
    },
    { key: "items", header: "Hạng mục", align: "num", cell: (row) => row.items.length },
    { key: "appointments", header: "Lịch hẹn", align: "num", cell: (row) => row._count.appointments },
  ];

  const list = (
    <DsPanel flush>
      <form onSubmit={(event) => event.preventDefault()} aria-label="Lọc gói khám">
        <DsToolbar>
          <div style={{ minWidth: 180, flex: "1 1 240px" }}>
            <DsInput
              aria-label="Tìm gói khám"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Gõ tên, đường dẫn hoặc tóm tắt để lọc"
            />
          </div>
          <div style={{ minWidth: 130, flex: "0 1 160px" }}>
            <DsSelect
              aria-label="Lọc gói nổi bật"
              value={popular}
              onChange={(event) => {
                setPopular(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Mọi gói</option>
              <option value="true">Nổi bật</option>
              <option value="false">Thường</option>
            </DsSelect>
          </div>
          {canWrite ? (
            <DsButton variant="primary" onClick={startCreate}>
              <Plus aria-hidden="true" />
              Tạo gói khám
            </DsButton>
          ) : null}
        </DsToolbar>
      </form>
      <DsTabs
        label="Lọc gói khám theo trạng thái"
        items={statusTabs}
        value={status}
        onChange={(id) => {
          setStatus(id);
          setPage(1);
        }}
      />
      {open ? (
        packages.length ? (
          <div role="listbox" aria-label="Danh sách gói khám">
            {packages.map((item) => (
              <button key={item.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "edit" && pane.id === item.id} onClick={() => openPackage(item)}>
                <span className="ds-listrow__main">
                  <strong>{item.name}</strong>
                  <small>
                    {formatCurrency(item.finalPrice)} · {item.items.length} hạng mục
                  </small>
                </span>
                <DsStatusPill tone={item.isActive ? "good" : "neutral"}>{item.isActive ? "Hiển thị" : "Tạm ẩn"}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có gói khám phù hợp" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách gói khám"
          columns={columns}
          rows={packages}
          rowKey={(row) => row.id}
          loading={packagesQuery.isLoading}
          emptyTitle="Chưa có gói khám phù hợp"
          emptyDescription={canWrite ? "Đổi bộ lọc hoặc bấm Tạo gói khám." : undefined}
          onRowClick={openPackage}
        />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} gói · trang {pagination.page}/{pagination.totalPages || 1}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <DsButton disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
            Trước
          </DsButton>
          <DsButton disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
            Sau
          </DsButton>
        </span>
      </div>
    </DsPanel>
  );

  const packageForm = (
    <form onSubmit={handleSubmit} className="ds-editor__col" aria-label={selected ? "Cập nhật gói khám" : "Tạo gói khám"}>
      <div className="ds-card">
        <div className="ds-card__head">
          <h3>Thông tin gói</h3>
        </div>
        <div className="ds-card__body">
          <DsField label="Tên gói khám" htmlFor="pk-name" required>
            <DsInput id="pk-name" value={form.name} required disabled={!canWrite} onChange={(event) => handleNameChange(event.target.value)} />
          </DsField>
          <div className="ds-grid-fields">
            <DsField label="Đường dẫn" htmlFor="pk-slug" hint="Tự sinh theo tên gói">
              <DsInput
                id="pk-slug"
                value={form.slug}
                disabled={!canWrite}
                onChange={(event) => {
                  setSlugTouched(true);
                  setForm((current) => ({ ...current, slug: createSlug(event.target.value) }));
                }}
              />
            </DsField>
            <DsField label="Chuyên khoa" htmlFor="pk-dept">
              <DsSelect id="pk-dept" value={form.departmentId} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}>
                <option value="">Tất cả khoa</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </DsSelect>
            </DsField>
            <DsField label="Giá nền khi chưa có hạng mục" htmlFor="pk-base">
              <DsInput id="pk-base" inputMode="numeric" value={formatMoneyInput(form.basePrice)} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, basePrice: parseMoneyInput(event.target.value) }))} />
            </DsField>
            <DsField label="Phí dịch vụ" htmlFor="pk-fee">
              <DsInput id="pk-fee" inputMode="numeric" value={formatMoneyInput(form.serviceFee)} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, serviceFee: parseMoneyInput(event.target.value) }))} />
            </DsField>
          </div>
          <p className="ds-hint" style={{ margin: 0 }}>
            Khi gói có hạng mục “Đã bao gồm”, hệ thống tự lấy tổng giá hạng mục để tính giá gói. Giá nền chỉ dùng khi chưa có hạng mục.
          </p>
          <DsField label="Tóm tắt" htmlFor="pk-summary">
            <DsInput id="pk-summary" value={form.summary} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} />
          </DsField>
          <DsField label="Mô tả" htmlFor="pk-desc">
            <DsTextarea id="pk-desc" rows={3} value={form.description} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </DsField>
          <DsField label="Ghi chú" htmlFor="pk-note">
            <DsTextarea id="pk-note" rows={2} value={form.note} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
          </DsField>
          {(
            [
              ["isPopular", "Gói nổi bật", "Hiện ở nhóm nổi bật trên website."],
              ["isBHYTSupport", "Hỗ trợ BHYT", "Cho phép tính giảm trừ BHYT khi lập hóa đơn."],
              ["isActive", "Đang hiển thị", "Gói tạm ẩn không hiện khi đặt lịch."],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="ds-check" style={{ cursor: canWrite ? "pointer" : "default" }}>
              <input type="checkbox" checked={form[key]} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.checked }))} style={{ marginTop: 3 }} />
              <span>
                <strong>{label}</strong>
                <small style={{ display: "block", color: "var(--ds-muted)" }}>{hint}</small>
              </span>
            </label>
          ))}
          {canWrite ? (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <DsButton onClick={closePane}>Đóng</DsButton>
              <DsButton type="submit" variant="primary" disabled={saving || !form.name.trim()}>
                {saving ? "Đang lưu..." : selected ? "Lưu thay đổi" : "Tạo gói"}
              </DsButton>
            </div>
          ) : null}
          {selected && canDelete ? (
            confirmDelete ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13 }}>Xóa gói {selected.name}?</span>
                <DsButton variant="danger" disabled={saving} onClick={() => void handleDelete()}>
                  Xóa
                </DsButton>
                <DsButton onClick={() => setConfirmDelete(false)}>Giữ lại</DsButton>
              </div>
            ) : (
              <div>
                <DsButton variant="ghost" onClick={() => setConfirmDelete(true)}>
                  Xóa gói khám
                </DsButton>
              </div>
            )
          ) : null}
        </div>
      </div>
    </form>
  );

  const itemsColumn = selected ? (
    <div className="ds-editor__col">
      <div className="ds-card">
        <div className="ds-card__head">
          <h3>Hạng mục ({selected.items.length})</h3>
          {canWrite && !itemOpen ? <DsButton onClick={startAddItem}>Thêm hạng mục</DsButton> : null}
        </div>
        <div className="ds-card__body">
          <DsKeyValue
            items={[
              { label: "Tổng hạng mục đã bao gồm", value: formatCurrency(selected.includedItemsTotal ?? getIncludedItemsTotal(selected.items)) },
              { label: "Giá gói", value: <strong>{formatCurrency(selected.finalPrice)}</strong> },
            ]}
          />
        </div>
        {selected.items.length === 0 && !itemOpen ? <p style={{ margin: 0, padding: 14, color: "var(--ds-muted)" }}>Chưa có hạng mục.</p> : null}
        {selected.items.map((item) => (
          <div key={item.id} className="ds-labrow">
            <div className="ds-labrow__main">
              <strong>
                {item.order}. {item.name}
              </strong>
              <small>{formatCurrency(item.price)} · {item.included ? "Đã bao gồm trong giá gói" : "Không tính vào giá gói"}</small>
              {item.description ? <small>{item.description}</small> : null}
              {deleteItemTarget?.id === item.id ? (
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13 }}>Xóa hạng mục này?</span>
                  <DsButton variant="danger" disabled={saving} onClick={() => void handleDeleteItem()}>
                    Xóa
                  </DsButton>
                  <DsButton onClick={() => setDeleteItemTarget(null)}>Giữ lại</DsButton>
                </div>
              ) : null}
            </div>
            {canWrite && deleteItemTarget?.id !== item.id ? (
              <span style={{ display: "flex", gap: 4 }}>
                <DsButton variant="ghost" onClick={() => startEditItem(item)}>
                  Sửa
                </DsButton>
                <DsButton
                  variant="ghost"
                  onClick={() => {
                    setDeleteItemTarget(item);
                    setItemOpen(false);
                    setEditingItem(null);
                  }}
                >
                  Xóa
                </DsButton>
              </span>
            ) : null}
          </div>
        ))}
        {itemOpen && canWrite ? (
          <form className="ds-card__body" onSubmit={handleItemSubmit} style={{ borderTop: "1px solid var(--ds-line)" }} aria-label={editingItem ? "Sửa hạng mục" : "Thêm hạng mục"}>
            <DsField label="Tên hạng mục" htmlFor="it-name" required>
              <DsInput id="it-name" value={itemForm.name} required onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} />
            </DsField>
            <DsField label="Mô tả" htmlFor="it-desc">
              <DsTextarea id="it-desc" rows={2} value={itemForm.description} onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))} />
            </DsField>
            <div className="ds-grid-fields">
              <DsField label="Giá" htmlFor="it-price">
                <DsInput id="it-price" inputMode="numeric" value={formatMoneyInput(itemForm.price)} onChange={(event) => setItemForm((current) => ({ ...current, price: parseMoneyInput(event.target.value) }))} />
              </DsField>
              <DsField label="Thứ tự" htmlFor="it-order">
                <DsInput id="it-order" inputMode="numeric" value={itemForm.order} onChange={(event) => setItemForm((current) => ({ ...current, order: event.target.value.replace(/\D/g, "") }))} />
              </DsField>
            </div>
            <label className="ds-check" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={itemForm.included} onChange={(event) => setItemForm((current) => ({ ...current, included: event.target.checked }))} style={{ marginTop: 3 }} />
              <span>
                <strong>Đã bao gồm trong giá gói</strong>
              </span>
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <DsButton onClick={resetItemEditor}>Hủy</DsButton>
              <DsButton type="submit" variant="primary" disabled={saving || !itemForm.name.trim()}>
                {saving ? "Đang lưu..." : editingItem ? "Lưu hạng mục" : "Thêm hạng mục"}
              </DsButton>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  ) : null;

  const paneNode = open ? (
    <DsPane
      wide={Boolean(selected)}
      bodyClassName={selected ? "ds-pane__body ds-pane__body--flush" : undefined}
      title={selected ? selected.name : "Tạo gói khám"}
      badge={selected ? <DsStatusPill tone={selected.isActive ? "good" : "neutral"}>{selected.isActive ? "Hiển thị" : "Tạm ẩn"}</DsStatusPill> : undefined}
      onClose={closePane}
    >
      {selected ? (
        <div className="ds-editor">
          {packageForm}
          {itemsColumn}
        </div>
      ) : (
        packageForm
      )}
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader title="Gói khám" description="Giá, phí dịch vụ, hỗ trợ BHYT và các hạng mục cấu thành từng gói" />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {visibleError ? <DsNotice tone="bad">{visibleError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsSplit wide={Boolean(selected)} list={list} pane={paneNode} />
    </>
  );
}
