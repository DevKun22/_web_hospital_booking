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
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsTextarea,
  DsToolbar,
  type DsColumn,
} from "@/components/ds";
import { apiRequest, uploadImages } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardDepartments } from "@/lib/dashboard-departments-query";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { Department } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Chuyên khoa: danh sách bên trái; chọn một khoa hoặc bấm "Tạo chuyên khoa" thì biểu mẫu mở cạnh danh sách, không che nội dung.

type DepartmentForm = {
  name: string;
  slug: string;
  description: string;
  image: string;
  imageAssetId: string;
  symptomKeywords: string;
  triageDescription: string;
  isTriageFallback: boolean;
  isActive: boolean;
};

const emptyForm: DepartmentForm = {
  name: "",
  slug: "",
  description: "",
  image: "",
  imageAssetId: "",
  symptomKeywords: "",
  triageDescription: "",
  isTriageFallback: false,
  isActive: true,
};

const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "true", label: "Đang hoạt động" },
  { id: "false", label: "Tạm ẩn" },
];

const toForm = (department: Department): DepartmentForm => ({
  name: department.name,
  slug: department.slug || "",
  description: department.description || "",
  image: department.image || "",
  imageAssetId: "",
  symptomKeywords: department.symptomKeywords.join(", "),
  triageDescription: department.triageDescription || "",
  isTriageFallback: department.isTriageFallback,
  isActive: department.isActive,
});

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

const buildPayload = (form: DepartmentForm) => ({
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  description: form.description.trim() || null,
  image: form.image.trim() || null,
  imageAssetId: form.imageAssetId || undefined,
  symptomKeywords: Array.from(
    new Set(
      form.symptomKeywords
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ),
  triageDescription: form.triageDescription.trim() || null,
  isTriageFallback: form.isTriageFallback,
  isActive: form.isActive,
});

type PaneState = { kind: "new" } | { kind: "edit"; id: string } | null;

export default function DepartmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pane, setPane] = useState<PaneState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);

  const canWrite = can(user, "catalog.manage");
  const canDelete = can(user, "catalog.delete");

  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const term = useDebouncedValue(search.trim());
  const query = useMemo(() => ({ search: term || undefined, isActive: status || undefined, page, limit: 10 }), [page, status, term]);
  const departmentsQuery = useDashboardDepartments(query);
  const departments = departmentsQuery.data?.items ?? [];
  const pagination = departmentsQuery.data?.pagination ?? { page, limit: 10, total: 0, totalPages: 1 };
  const queryErrorMessage = departmentsQuery.error ? (departmentsQuery.error instanceof Error ? departmentsQuery.error.message : "Không tải được danh sách chuyên khoa") : "";
  const visibleError = error || queryErrorMessage;
  const editing = pane?.kind === "edit" ? departments.find((item) => item.id === pane.id) ?? null : null;
  const open = canWrite && (pane?.kind === "new" || (pane?.kind === "edit" && Boolean(editing)));

  const invalidateDepartments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "departments"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "departments"] }),
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

  const startCreate = () => {
    setForm(emptyForm);
    setSlugTouched(false);
    setConfirmDelete(false);
    setError("");
    setPane({ kind: "new" });
  };

  const startEdit = (department: Department) => {
    if (!canWrite) return;
    setForm(toForm(department));
    setSlugTouched(false);
    setConfirmDelete(false);
    setError("");
    setPane({ kind: "edit", id: department.id });
  };

  const closePane = () => {
    setPane(null);
    setConfirmDelete(false);
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
        await apiRequest<Department>(`/dashboard/departments/${pane.id}`, { method: "PATCH", body: buildPayload(form) });
        setNotice("Đã cập nhật chuyên khoa");
      } else {
        await apiRequest<Department>("/dashboard/departments", { method: "POST", body: buildPayload(form) });
        setNotice("Đã tạo chuyên khoa");
        closePane();
      }
      await invalidateDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được chuyên khoa");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File | undefined) => {
    if (!file || !canWrite) return;

    setUploading(true);
    setError("");
    setNotice("");

    try {
      const [asset] = await uploadImages([file], "departments");
      if (!asset) throw new Error("Đã tải lên nhưng không nhận được thông tin ảnh");
      setForm((current) => ({ ...current, image: asset.url, imageAssetId: asset.id }));
      setNotice("Đã tải ảnh chuyên khoa lên. Bấm Lưu thay đổi để áp dụng.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh lên");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || !canDelete) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<Department>(`/dashboard/departments/${editing.id}`, { method: "DELETE" });
      setNotice("Đã xóa chuyên khoa");
      closePane();
      await invalidateDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được chuyên khoa");
    } finally {
      setSaving(false);
    }
  };

  const columns: DsColumn<Department>[] = [
    {
      key: "name",
      header: "Chuyên khoa",
      cell: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description || "Chưa có mô tả"}</div>
        </div>
      ),
    },
    { key: "slug", header: "Đường dẫn", cell: (row) => <span className="ds-mono">{row.slug || "-"}</span> },
    { key: "doctors", header: "Bác sĩ", align: "num", cell: (row) => row._count.doctors },
    { key: "appointments", header: "Lịch hẹn", align: "num", cell: (row) => row._count.appointments },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={row.isActive ? "good" : "neutral"}>{row.isActive ? "Hoạt động" : "Tạm ẩn"}</DsStatusPill> },
  ];

  const list = (
    <DsPanel flush>
      <form onSubmit={(event) => event.preventDefault()} aria-label="Lọc chuyên khoa">
        <DsToolbar>
          <div style={{ minWidth: 180, flex: "1 1 240px" }}>
            <DsInput
              aria-label="Tìm chuyên khoa"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Gõ tên hoặc đường dẫn để lọc"
            />
          </div>
          {canWrite ? (
            <DsButton variant="primary" onClick={startCreate}>
              <Plus aria-hidden="true" />
              Tạo chuyên khoa
            </DsButton>
          ) : null}
        </DsToolbar>
      </form>
      <DsTabs
        label="Lọc chuyên khoa theo trạng thái"
        items={statusTabs}
        value={status}
        onChange={(id) => {
          setStatus(id);
          setPage(1);
        }}
      />
      {open ? (
        departments.length ? (
          <div role="listbox" aria-label="Danh sách chuyên khoa">
            {departments.map((department) => (
              <button key={department.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "edit" && pane.id === department.id} onClick={() => startEdit(department)}>
                <span className="ds-listrow__main">
                  <strong>{department.name}</strong>
                  <small>
                    {department._count.doctors} bác sĩ · {department._count.appointments} lịch hẹn
                  </small>
                </span>
                <DsStatusPill tone={department.isActive ? "good" : "neutral"}>{department.isActive ? "Hoạt động" : "Tạm ẩn"}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có chuyên khoa phù hợp" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách chuyên khoa"
          columns={columns}
          rows={departments}
          rowKey={(row) => row.id}
          loading={departmentsQuery.isLoading}
          emptyTitle="Chưa có chuyên khoa phù hợp"
          emptyDescription={canWrite ? "Đổi bộ lọc hoặc bấm Tạo chuyên khoa." : undefined}
          onRowClick={canWrite ? startEdit : undefined}
        />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} chuyên khoa · trang {pagination.page}/{pagination.totalPages || 1}
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

  const paneNode = open ? (
    <DsPane
      title={editing ? `Chuyên khoa ${editing.name}` : "Tạo chuyên khoa"}
      badge={editing ? <DsStatusPill tone={editing.isActive ? "good" : "neutral"}>{editing.isActive ? "Hoạt động" : "Tạm ẩn"}</DsStatusPill> : undefined}
      onClose={closePane}
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }} aria-label={editing ? "Cập nhật chuyên khoa" : "Tạo chuyên khoa"}>
        <DsField label="Tên chuyên khoa" htmlFor="dep-name" required>
          <DsInput id="dep-name" value={form.name} required onChange={(event) => handleNameChange(event.target.value)} />
        </DsField>
        <DsField label="Đường dẫn" htmlFor="dep-slug" hint="Tự sinh từ tên nhưng có thể chỉnh tay">
          <DsInput
            id="dep-slug"
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true);
              setForm((current) => ({ ...current, slug: createSlug(event.target.value) }));
            }}
          />
        </DsField>
        <DsField label="Mô tả" htmlFor="dep-desc">
          <DsTextarea id="dep-desc" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </DsField>
        <DsField label="Từ khóa triệu chứng" htmlFor="dep-keywords" hint="Phân tách bằng dấu phẩy hoặc xuống dòng. Chatbot dùng dữ liệu này để gợi ý khoa.">
          <DsTextarea id="dep-keywords" rows={3} placeholder="ngứa da, nổi mẩn, phát ban" value={form.symptomKeywords} onChange={(event) => setForm((current) => ({ ...current, symptomKeywords: event.target.value }))} />
        </DsField>
        <DsField label="Mô tả định hướng" htmlFor="dep-triage">
          <DsTextarea id="dep-triage" rows={2} placeholder="Tiếp nhận các vấn đề về da, tóc, móng..." value={form.triageDescription} onChange={(event) => setForm((current) => ({ ...current, triageDescription: event.target.value }))} />
        </DsField>

        <div className="ds-card">
          <div className="ds-card__head">
            <h3>Ảnh chuyên khoa</h3>
          </div>
          <div className="ds-card__body">
            {form.image ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image} alt={form.name || "Ảnh chuyên khoa"} style={{ width: "100%", height: 144, objectFit: "cover", borderRadius: 6 }} />
                <DsButton variant="ghost" onClick={() => setForm((current) => ({ ...current, image: "", imageAssetId: "" }))}>
                  Gỡ ảnh
                </DsButton>
              </div>
            ) : null}
            <div
              className={`ds-drop${dragOver ? " is-over" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                void handleImageUpload(event.dataTransfer.files?.[0]);
              }}
            >
              {uploading ? (
                "Đang tải ảnh lên..."
              ) : (
                <>
                  Kéo thả ảnh vào đây hoặc <label htmlFor="dep-image-file">chọn từ máy</label>
                  <input
                    id="dep-image-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      void handleImageUpload(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <div className="ds-hint" style={{ marginTop: 4 }}>
                    JPG, PNG hoặc WEBP
                  </div>
                </>
              )}
            </div>
            <DsField label="Hoặc dán đường dẫn ảnh" htmlFor="dep-image-url">
              <DsInput id="dep-image-url" value={form.image} placeholder="https://..." onChange={(event) => setForm((current) => ({ ...current, image: event.target.value, imageAssetId: "" }))} />
            </DsField>
          </div>
        </div>

        <label className="ds-check" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={form.isTriageFallback} onChange={(event) => setForm((current) => ({ ...current, isTriageFallback: event.target.checked }))} style={{ marginTop: 3 }} />
          <span>
            <strong>Khoa tiếp nhận ban đầu</strong>
            <small style={{ display: "block", color: "var(--ds-muted)" }}>Dùng khi chưa đủ dữ liệu để gợi ý khoa cụ thể.</small>
          </span>
        </label>
        <label className="ds-check" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} style={{ marginTop: 3 }} />
          <span>
            <strong>Đang hoạt động</strong>
            <small style={{ display: "block", color: "var(--ds-muted)" }}>Chuyên khoa tạm ẩn không hiện trên website đặt lịch.</small>
          </span>
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <DsButton onClick={closePane}>Đóng</DsButton>
          <DsButton type="submit" variant="primary" disabled={saving || uploading || !form.name.trim()}>
            {uploading ? "Đang tải lên..." : saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo mới"}
          </DsButton>
        </div>

        {editing && canDelete ? (
          confirmDelete ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}>Xóa chuyên khoa {editing.name}?</span>
              <DsButton variant="danger" disabled={saving} onClick={() => void handleDelete()}>
                Xóa
              </DsButton>
              <DsButton onClick={() => setConfirmDelete(false)}>Giữ lại</DsButton>
            </div>
          ) : (
            <div>
              <DsButton variant="ghost" onClick={() => setConfirmDelete(true)}>
                Xóa chuyên khoa
              </DsButton>
            </div>
          )
        ) : null}
      </form>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader title="Chuyên khoa" description="Khoa phòng dùng xuyên suốt hồ sơ bác sĩ, gói khám, chatbot và lịch hẹn" />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {visibleError ? <DsNotice tone="bad">{visibleError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsSplit list={list} pane={paneNode} />
    </>
  );
}
