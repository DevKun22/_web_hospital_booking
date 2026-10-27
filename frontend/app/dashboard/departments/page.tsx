"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PanelRightOpen, Plus, Search } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardPageHeader, DashboardStatusBadge, DashboardSurface } from "@/components/dashboard/dashboard-ui";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, uploadImages } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardDepartments } from "@/lib/dashboard-departments-query";
import { queryKeys } from "@/lib/query-keys";
import type { Department } from "@/lib/types";

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

const statusOptions = [
  { label: "Tất cả", value: "" },
  { label: "Đang hoạt động", value: "true" },
  { label: "Tạm ẩn", value: "false" },
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
    .replace(/[\u0300-\u036f]/g, "")
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

export default function DepartmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const listPanelRef = useRef<HTMLElement | null>(null);
  const formPanelRef = useRef<HTMLElement | null>(null);

  const canWrite = user?.role === "ADMIN" || user?.role === "STAFF";
  const canDelete = user?.role === "ADMIN";

  const query = useMemo(
    () => ({
      search: appliedSearch || undefined,
      isActive: status || undefined,
      page,
      limit: 10,
    }),
    [appliedSearch, page, status],
  );
  const departmentsQuery = useDashboardDepartments(query);
  const loading = departmentsQuery.isLoading;
  const departments = departmentsQuery.data?.items ?? [];
  const pagination = departmentsQuery.data?.pagination ?? { page, limit: 10, total: 0, totalPages: 1 };
  const queryErrorMessage = departmentsQuery.error
    ? departmentsQuery.error instanceof Error
      ? departmentsQuery.error.message
      : "Không tải được danh sách chuyên khoa"
    : "";
  const visibleError = error || queryErrorMessage;

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const invalidateDepartments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "departments"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "departments"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
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

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const startCreate = () => {
    setWorkspaceOpen(true);
    setEditing(null);
    setDeleteTarget(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setNotice("");
    setError("");
    scrollTo(formPanelRef);
  };

  const startEdit = (department: Department) => {
    setWorkspaceOpen(true);
    setEditing(department);
    setDeleteTarget(null);
    setForm(toForm(department));
    setSlugTouched(false);
    setNotice("");
    setError("");
    scrollTo(formPanelRef);
  };

  const startDelete = (department: Department) => {
    setWorkspaceOpen(true);
    setDeleteTarget(department);
    setEditing(null);
    setNotice("");
    setError("");
    scrollTo(formPanelRef);
  };

  const handleNameChange = (name: string) => {
    setForm((current) => {
      const currentSlugWasAuto = !current.slug || current.slug === createSlug(current.name);

      return {
        ...current,
        name,
        slug: !slugTouched && currentSlugWasAuto ? createSlug(name) : current.slug,
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editing) {
        await apiRequest<Department>(`/dashboard/departments/${editing.id}`, {
          method: "PATCH",
          body: buildPayload(form),
        });
        setNotice("Đã cập nhật chuyên khoa");
      } else {
        await apiRequest<Department>("/dashboard/departments", {
          method: "POST",
          body: buildPayload(form),
        });
        setNotice("Đã tạo chuyên khoa");
      }

      setEditing(null);
      setForm(emptyForm);
      setSlugTouched(false);
      await invalidateDepartments();
      scrollTo(listPanelRef);
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

      setForm((current) => ({
        ...current,
        image: asset.url,
        imageAssetId: asset.id,
      }));
      setNotice("Đã tải ảnh chuyên khoa lên");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh lên");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<Department>(`/dashboard/departments/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      setNotice("Đã xóa chuyên khoa");
      await invalidateDepartments();
      scrollTo(listPanelRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được chuyên khoa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${workspaceOpen && canWrite ? "xl:grid-cols-[minmax(0,1fr)_400px]" : "xl:grid-cols-1"}`}>
      <DashboardFeedback error={visibleError} notice={notice} onDismiss={queryErrorMessage ? undefined : () => { setError(""); setNotice(""); }} />

      <section ref={listPanelRef} className="min-w-0 scroll-mt-24 space-y-4">
        <DashboardPageHeader eyebrow="Dữ liệu nền" title="Chuyên khoa" description="Quản lý khoa phòng dùng xuyên suốt hồ sơ bác sĩ, gói khám, chatbot và lịch hẹn."
          actions={canWrite ? <><Button onClick={startCreate} size="lg"><Plus />Tạo chuyên khoa</Button>{!workspaceOpen && (editing || deleteTarget) ? <Button variant="outline" size="lg" onClick={() => setWorkspaceOpen(true)}><PanelRightOpen />Mở lại biểu mẫu</Button> : null}</> : undefined}
        />

        <DashboardSurface>
          <form onSubmit={applySearch} className="grid gap-3 border-b border-border p-4 md:grid-cols-[1fr_180px_auto]">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc đường dẫn" />
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Button type="submit"><Search />Tìm kiếm</Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[#667892]">
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Tên khoa</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Đường dẫn</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Bác sĩ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Lịch hẹn</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Đang tải danh sách...</td></tr>
                ) : departments.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Chưa có chuyên khoa phù hợp</td></tr>
                ) : departments.map((department) => (
                  <tr key={department.id} className={`align-top transition-colors ${editing?.id === department.id || deleteTarget?.id === department.id ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <p className="font-semibold text-[#172033]">{department.name}</p>
                      <p className="mt-1 max-w-sm truncate text-xs text-[#667892]">{department.description || "Chưa có mô tả"}</p>
                    </td>
                    <td className="border-b border-[#eef2f7] px-4 py-3 text-[#42526b]">{department.slug || "-"}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{department._count.doctors}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{department._count.appointments}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <DashboardStatusBadge tone={department.isActive ? "positive" : "neutral"}>{department.isActive ? "Hoạt động" : "Tạm ẩn"}</DashboardStatusBadge>
                    </td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canWrite ? <button onClick={() => startEdit(department)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b] hover:bg-[#f6f8fb]">Sửa</button> : null}
                        {canDelete ? <button onClick={() => startDelete(department)} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e] hover:bg-[#fff3f2]">Xóa</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#e5ebf3] px-4 py-3 text-sm text-[#667892]">
            <span>{pagination.total} kết quả, trang {pagination.page}/{pagination.totalPages || 1}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Trước</button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Sau</button>
            </div>
          </div>
        </DashboardSurface>
      </section>

      {workspaceOpen && canWrite ? (
      <aside ref={formPanelRef} className="min-w-0 scroll-mt-24">
        <DashboardWorkspace
          open={workspaceOpen}
          onOpenChange={setWorkspaceOpen}
          title={editing ? `Chuyên khoa ${editing.name}` : "Công cụ chuyên khoa"}
          description="Tạo và cập nhật thông tin hiển thị, điều hướng triệu chứng và trạng thái hoạt động."
        >
        {deleteTarget ? (
          <div className="mb-5 rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4">
            <h3 className="font-semibold text-[#b3261e]">Xác nhận xóa chuyên khoa</h3>
            <p className="mt-2 text-sm text-[#5f2630]">{deleteTarget.name}</p>
            <div className="mt-3 flex gap-2">
              <button disabled={saving} onClick={() => void handleDelete()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xóa</button>
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Hủy</button>
            </div>
          </div>
        ) : null}

        <h3 className="text-lg font-semibold">{editing ? "Cập nhật chuyên khoa" : "Tạo chuyên khoa"}</h3>
        <p className="mt-2 text-sm leading-6 text-[#667892]">Đường dẫn tự sinh từ tên chuyên khoa nhưng vẫn có thể chỉnh thủ công.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Tên chuyên khoa</span><input value={form.name} onChange={(event) => handleNameChange(event.target.value)} disabled={!canWrite} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" required /></label>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Đường dẫn</span><input value={form.slug} onChange={(event) => { setSlugTouched(true); setForm((current) => ({ ...current, slug: createSlug(event.target.value) })); }} disabled={!canWrite} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Mô tả</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} disabled={!canWrite} rows={4} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
          <label className="block">
            <span className="text-sm font-medium text-[#334155]">Từ khóa triệu chứng</span>
            <textarea
              value={form.symptomKeywords}
              onChange={(event) => setForm((current) => ({ ...current, symptomKeywords: event.target.value }))}
              disabled={!canWrite}
              rows={3}
              placeholder="ngứa da, nổi mẩn, phát ban"
              className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]"
            />
            <span className="mt-1 block text-xs text-[#667892]">Phân tách bằng dấu phẩy hoặc xuống dòng. Chatbot dùng dữ liệu này để gợi ý khoa.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#334155]">Mô tả định hướng</span>
            <textarea
              value={form.triageDescription}
              onChange={(event) => setForm((current) => ({ ...current, triageDescription: event.target.value }))}
              disabled={!canWrite}
              rows={3}
              placeholder="Tiếp nhận các vấn đề về da, tóc, móng..."
              className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]"
            />
          </label>
          <label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2">
            <span>
              <span className="block text-sm font-medium text-[#334155]">Khoa tiếp nhận ban đầu</span>
              <span className="mt-1 block text-xs text-[#667892]">Dùng khi chưa đủ dữ liệu để gợi ý khoa cụ thể.</span>
            </span>
            <input type="checkbox" checked={form.isTriageFallback} onChange={(event) => setForm((current) => ({ ...current, isTriageFallback: event.target.checked }))} disabled={!canWrite} className="h-4 w-4 accent-[#0d4f8b]" />
          </label>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Đường dẫn hình ảnh</span><input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value, imageAssetId: "" }))} disabled={!canWrite} placeholder="https://..." className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
          <label className="block">
            <span className="text-sm font-medium text-[#334155]">Tải ảnh lên</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!canWrite || uploading} onChange={(event) => void handleImageUpload(event.target.files?.[0])} className="mt-1 w-full rounded-md border border-dashed border-[#cfd8e6] bg-[#f8fafc] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#0d4f8b] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:opacity-60" />
            <p className="mt-1 text-xs text-[#667892]">Hỗ trợ JPG, PNG và WEBP. Ảnh được lưu trong thư mục chuyên khoa.</p>
          </label>
          {form.image ? (
            <div className="rounded-md border border-[#e5ebf3] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.image} alt={form.name || "Ảnh chuyên khoa"} className="h-36 w-full rounded-md object-cover" />
              <p className="mt-2 truncate text-xs text-[#667892]">{form.imageAssetId ? `Mã tài nguyên: ${form.imageAssetId}` : form.image}</p>
            </div>
          ) : null}
          <label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2"><span className="text-sm font-medium text-[#334155]">Đang hoạt động</span><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} disabled={!canWrite} className="h-4 w-4 accent-[#0d4f8b]" /></label>

          {canWrite ? (
            <div className="flex gap-2">
              <button disabled={saving || uploading} className="flex-1 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{uploading ? "Đang tải lên..." : saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo mới"}</button>
              {editing ? <button type="button" onClick={startCreate} className="rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-medium text-[#42526b] hover:bg-[#f6f8fb]">Hủy</button> : null}
            </div>
          ) : null}
        </form>
        </DashboardWorkspace>
      </aside>
      ) : null}
    </div>
  );
}
