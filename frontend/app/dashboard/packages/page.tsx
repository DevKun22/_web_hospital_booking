"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PanelRightOpen, Plus, Search } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardPageHeader, DashboardStatusBadge, DashboardSurface } from "@/components/dashboard/dashboard-ui";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardDepartments } from "@/lib/dashboard-departments-query";
import { useDashboardPackages } from "@/lib/dashboard-packages-query";
import { queryKeys } from "@/lib/query-keys";
import type { MedicalPackage, PackageItem } from "@/lib/types";

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

const emptyItemForm: ItemForm = {
  name: "",
  description: "",
  price: "0",
  included: true,
  order: "0",
};

const statusOptions = [
  { label: "Tất cả", value: "" },
  { label: "Đang hiển thị", value: "true" },
  { label: "Tạm ẩn", value: "false" },
];

const popularOptions = [
  { label: "Tất cả", value: "" },
  { label: "Nổi bật", value: "true" },
  { label: "Thường", value: "false" },
];

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

const parseMoneyInput = (value: string) => value.replace(/\D/g, "");

const formatMoneyInput = (value: string) => {
  const digits = parseMoneyInput(value);
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const getIncludedItemsTotal = (items: PackageItem[]) =>
  items.filter((item) => item.included).reduce((total, item) => total + item.price, 0);

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

export default function PackagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [popular, setPopular] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [editing, setEditing] = useState<MedicalPackage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicalPackage | null>(null);
  const [form, setForm] = useState<PackageForm>(emptyPackageForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [selectedPackageSnapshot, setSelectedPackage] = useState<MedicalPackage | null>(null);
  const [editingItem, setEditingItem] = useState<PackageItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<PackageItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const listPanelRef = useRef<HTMLElement | null>(null);
  const formPanelRef = useRef<HTMLElement | null>(null);
  const itemPanelRef = useRef<HTMLElement | null>(null);

  const canWrite = user?.role === "ADMIN" || user?.role === "STAFF";
  const canDelete = user?.role === "ADMIN";

  const query = useMemo(
    () => ({
      search: appliedSearch || undefined,
      isActive: status || undefined,
      isPopular: popular || undefined,
      page,
      limit: 10,
    }),
    [appliedSearch, page, popular, status],
  );
  const departmentQuery = useMemo(() => ({ isActive: "true", limit: 100 }), []);
  const packagesQuery = useDashboardPackages(query);
  const departmentsQuery = useDashboardDepartments(departmentQuery);
  const loading = packagesQuery.isLoading;
  const packages = packagesQuery.data?.items ?? [];
  const departments = departmentsQuery.data?.items ?? [];
  const pagination = packagesQuery.data?.pagination ?? { page, limit: 10, total: 0, totalPages: 1 };
  const selectedPackage = selectedPackageSnapshot
    ? packages.find((item) => item.id === selectedPackageSnapshot.id) ?? selectedPackageSnapshot
    : null;
  const queryError = packagesQuery.error || departmentsQuery.error;
  const queryErrorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Không tải được dữ liệu gói khám"
    : "";
  const visibleError = error || queryErrorMessage;

  const scrollToList = () => {
    window.setTimeout(() => listPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const scrollToForm = () => {
    window.setTimeout(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const scrollToItems = () => {
    window.setTimeout(() => itemPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const invalidatePackages = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "packages"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "packages"] }),
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
    setForm(emptyPackageForm);
    setSlugTouched(false);
    setError("");
    setNotice("");
    scrollToForm();
  };

  const startEdit = (item: MedicalPackage) => {
    setWorkspaceOpen(true);
    setEditing(item);
    setDeleteTarget(null);
    setForm(toPackageForm(item));
    setSlugTouched(false);
    setError("");
    setNotice("");
    scrollToForm();
  };

  const startDelete = (item: MedicalPackage) => {
    setWorkspaceOpen(true);
    setDeleteTarget(item);
    setEditing(null);
    setError("");
    setNotice("");
    scrollToForm();
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
        await apiRequest<MedicalPackage>(`/dashboard/packages/${editing.id}`, {
          method: "PATCH",
          body: buildPackagePayload(form),
        });
        setNotice("Đã cập nhật gói khám");
      } else {
        await apiRequest<MedicalPackage>("/dashboard/packages", {
          method: "POST",
          body: buildPackagePayload(form),
        });
        setNotice("Đã tạo gói khám");
      }

      setEditing(null);
      setForm(emptyPackageForm);
      setSlugTouched(false);
      await invalidatePackages();
      scrollToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được gói khám");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<MedicalPackage>(`/dashboard/packages/${deleteTarget.id}`, { method: "DELETE" });
      setNotice("Đã xóa gói khám");
      if (selectedPackage?.id === deleteTarget.id) setSelectedPackage(null);
      setDeleteTarget(null);
      await invalidatePackages();
      scrollToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được gói khám");
    } finally {
      setSaving(false);
    }
  };

  const openItems = (item: MedicalPackage) => {
    setWorkspaceOpen(false);
    setSelectedPackage(item);
    setEditingItem(null);
    setDeleteItemTarget(null);
    setItemForm({ ...emptyItemForm, order: String(item.items.length) });
    scrollToItems();
  };

  const startEditItem = (item: PackageItem) => {
    setEditingItem(item);
    setDeleteItemTarget(null);
    setItemForm(toItemForm(item));
    scrollToItems();
  };

  const handleItemSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !selectedPackage) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingItem) {
        await apiRequest<PackageItem>(`/dashboard/packages/${selectedPackage.id}/items/${editingItem.id}`, {
          method: "PATCH",
          body: buildItemPayload(itemForm),
        });
        setNotice("Đã cập nhật hạng mục");
      } else {
        await apiRequest<PackageItem>(`/dashboard/packages/${selectedPackage.id}/items`, {
          method: "POST",
          body: buildItemPayload(itemForm),
        });
        setNotice("Đã tạo hạng mục");
      }

      setEditingItem(null);
      setItemForm({ ...emptyItemForm, order: String(selectedPackage.items.length + 1) });
      await invalidatePackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được hạng mục");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!canWrite || !selectedPackage || !deleteItemTarget) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<PackageItem>(`/dashboard/packages/${selectedPackage.id}/items/${deleteItemTarget.id}`, {
        method: "DELETE",
      });
      setNotice("Đã xóa hạng mục");
      setDeleteItemTarget(null);
      await invalidatePackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được hạng mục");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${workspaceOpen && canWrite ? "xl:grid-cols-[minmax(0,1fr)_430px]" : "xl:grid-cols-1"}`}>
      <DashboardFeedback error={visibleError} notice={notice} onDismiss={queryErrorMessage ? undefined : () => { setError(""); setNotice(""); }} />

      <section ref={listPanelRef} className="min-w-0 scroll-mt-24 space-y-4">
        <DashboardPageHeader eyebrow="Dữ liệu nền" title="Gói khám" description="Quản lý giá, phí dịch vụ, hỗ trợ BHYT và các hạng mục cấu thành từng gói."
          actions={canWrite ? <><Button onClick={startCreate} size="lg"><Plus />Tạo gói khám</Button>{!workspaceOpen && (editing || deleteTarget) ? <Button variant="outline" size="lg" onClick={() => setWorkspaceOpen(true)}><PanelRightOpen />Mở lại biểu mẫu</Button> : null}</> : undefined}
        />

        <DashboardSurface>
          <form onSubmit={applySearch} className="grid gap-3 border-b border-border p-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_170px_150px_auto]">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên, đường dẫn hoặc tóm tắt" />
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={popular} onChange={(event) => { setPopular(event.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              {popularOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Button type="submit"><Search />Tìm kiếm</Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[#667892]">
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Gói khám</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Chuyên khoa</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Giá</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Nhãn</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Hạng mục</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Lịch hẹn</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[#667892]">Đang tải danh sách...</td></tr>
                ) : packages.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[#667892]">Chưa có gói khám phù hợp</td></tr>
                ) : packages.map((item) => {
                  const includedTotal = item.includedItemsTotal ?? getIncludedItemsTotal(item.items);

                  return (
                  <tr key={item.id} className={`align-top transition-colors ${editing?.id === item.id || deleteTarget?.id === item.id || selectedPackage?.id === item.id ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p className="font-semibold text-[#172033]">{item.name}</p><p className="mt-1 max-w-sm truncate text-xs text-[#667892]">{item.summary || item.slug || "Chưa có tóm tắt"}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{item.department?.name || "Tất cả khoa"}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p className="font-semibold">{formatCurrency(item.finalPrice)}</p><p className="mt-1 text-xs text-[#667892]">Hạng mục {formatCurrency(includedTotal || item.basePrice)} + phí {formatCurrency(item.serviceFee)}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.isPopular ? <DashboardStatusBadge tone="warning">Nổi bật</DashboardStatusBadge> : null}
                        {item.isBHYTSupport ? <DashboardStatusBadge tone="positive">BHYT</DashboardStatusBadge> : null}
                        <DashboardStatusBadge tone={item.isActive ? "positive" : "neutral"}>{item.isActive ? "Hiển thị" : "Tạm ẩn"}</DashboardStatusBadge>
                      </div>
                    </td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{item.items.length}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{item._count.appointments}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openItems(item)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b] hover:bg-[#f6f8fb]">Hạng mục</button>
                        {canWrite ? <button onClick={() => startEdit(item)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b] hover:bg-[#f6f8fb]">Sửa</button> : null}
                        {canDelete ? <button onClick={() => startDelete(item)} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e] hover:bg-[#fff3f2]">Xóa</button> : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
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

        {selectedPackage ? (
          <section ref={itemPanelRef} className="scroll-mt-24 rounded-md border border-[#dce3ee] bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div><p className="text-sm font-medium text-[#55708f]">Hạng mục gói khám</p><h3 className="mt-1 text-xl font-semibold">{selectedPackage.name}</h3></div>
              <button type="button" onClick={() => { setSelectedPackage(null); setEditingItem(null); setDeleteItemTarget(null); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b] hover:bg-[#f6f8fb]">Đóng</button>
            </div>

            {deleteItemTarget ? (
              <div className="mt-4 rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4">
                <h4 className="font-semibold text-[#b3261e]">Xác nhận xóa hạng mục</h4>
                <p className="mt-2 text-sm text-[#5f2630]">{deleteItemTarget.name}</p>
                <div className="mt-3 flex gap-2"><button disabled={saving} onClick={() => void handleDeleteItem()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xóa</button><button type="button" onClick={() => setDeleteItemTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Hủy</button></div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="overflow-x-auto rounded-md border border-[#e5ebf3]">
                <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
                  <thead><tr className="text-[#667892]"><th className="border-b border-[#e5ebf3] px-3 py-2 font-semibold">Thứ tự</th><th className="border-b border-[#e5ebf3] px-3 py-2 font-semibold">Hạng mục</th><th className="border-b border-[#e5ebf3] px-3 py-2 font-semibold">Giá</th><th className="border-b border-[#e5ebf3] px-3 py-2 font-semibold">Tính trong gói</th><th className="border-b border-[#e5ebf3] px-3 py-2 text-right font-semibold">Thao tác</th></tr></thead>
                  <tbody>
                    {selectedPackage.items.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-[#667892]">Chưa có hạng mục</td></tr>
                    ) : selectedPackage.items.map((item) => (
                      <tr key={item.id}>
                        <td className="border-b border-[#eef2f7] px-3 py-2">{item.order}</td>
                        <td className="border-b border-[#eef2f7] px-3 py-2"><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-[#667892]">{item.description || "Chưa có mô tả"}</p></td>
                        <td className="border-b border-[#eef2f7] px-3 py-2">{formatCurrency(item.price)}</td>
                        <td className="border-b border-[#eef2f7] px-3 py-2"><span className={`inline-flex w-fit whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${item.included ? "bg-[#e7f6ed] text-[#1f7a3a]" : "bg-[#fff4d6] text-[#8a5a00]"}`}>{item.included ? "Đã bao gồm" : "Tính riêng"}</span></td>
                        <td className="border-b border-[#eef2f7] px-3 py-2"><div className="flex justify-end gap-2">{canWrite ? <><button onClick={() => startEditItem(item)} className="rounded-md border border-[#cfd8e6] px-2 py-1 text-xs text-[#42526b]">Sửa</button><button onClick={() => setDeleteItemTarget(item)} className="rounded-md border border-[#f2b8b5] px-2 py-1 text-xs text-[#b3261e]">Xóa</button></> : null}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canWrite ? (
                <form className="space-y-3 rounded-md border border-[#e5ebf3] p-4" onSubmit={handleItemSubmit}>
                  <h4 className="font-semibold">{editingItem ? "Sửa hạng mục" : "Thêm hạng mục"}</h4>
                  <input value={itemForm.name} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} placeholder="Tên hạng mục" className="w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                  <textarea value={itemForm.description} onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))} placeholder="Mô tả" rows={3} className="w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block"><span className="text-xs font-medium text-[#667892]">Giá</span><input value={formatMoneyInput(itemForm.price)} onChange={(event) => setItemForm((current) => ({ ...current, price: parseMoneyInput(event.target.value) }))} placeholder="0" inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /></label>
                    <label className="block"><span className="text-xs font-medium text-[#667892]">Thứ tự</span><input value={itemForm.order} onChange={(event) => setItemForm((current) => ({ ...current, order: event.target.value.replace(/\D/g, "") }))} inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /></label>
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-md border border-[#e5ebf3] px-3 py-2"><span className="min-w-0 text-sm font-medium text-[#334155]">Đã bao gồm trong giá gói</span><input type="checkbox" checked={itemForm.included} onChange={(event) => setItemForm((current) => ({ ...current, included: event.target.checked }))} className="h-4 w-4 shrink-0 accent-[#0d4f8b]" /></label>
                  <div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-md bg-[#0d4f8b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Đang lưu..." : editingItem ? "Lưu hạng mục" : "Thêm hạng mục"}</button>{editingItem ? <button type="button" onClick={() => { setEditingItem(null); setItemForm({ ...emptyItemForm, order: String(selectedPackage.items.length) }); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Hủy</button> : null}</div>
                </form>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>

      {workspaceOpen && canWrite ? (
      <aside ref={formPanelRef} className="min-w-0 scroll-mt-24">
        <DashboardWorkspace
          open={workspaceOpen}
          onOpenChange={setWorkspaceOpen}
          title={editing ? `Gói khám ${editing.name}` : "Công cụ gói khám"}
          description="Quản lý giá, quyền lợi BHYT, nội dung hiển thị và trạng thái cung cấp dịch vụ."
        >
        {deleteTarget ? (
          <div className="mb-5 rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4">
            <h3 className="font-semibold text-[#b3261e]">Xác nhận xóa gói khám</h3>
            <p className="mt-2 text-sm text-[#5f2630]">{deleteTarget.name}</p>
            <div className="mt-3 flex gap-2"><button disabled={saving} onClick={() => void handleDelete()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xóa</button><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Hủy</button></div>
          </div>
        ) : null}

        <h3 className="text-lg font-semibold">{editing ? "Cập nhật gói khám" : "Tạo gói khám"}</h3>
        <p className="mt-2 text-sm leading-6 text-[#667892]">Đường dẫn tự sinh theo tên gói. Dữ liệu gói khám hiện chưa hỗ trợ trường hình ảnh nên màn này chưa có chức năng tải ảnh lên.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Tên gói khám</span><input value={form.name} onChange={(event) => handleNameChange(event.target.value)} disabled={!canWrite} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" required /></label>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Đường dẫn</span><input value={form.slug} onChange={(event) => { setSlugTouched(true); setForm((current) => ({ ...current, slug: createSlug(event.target.value) })); }} disabled={!canWrite} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Chuyên khoa</span><select value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))} disabled={!canWrite} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]"><option value="">Tất cả khoa</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-medium text-[#334155]">Giá nền khi chưa có hạng mục</span><input value={formatMoneyInput(form.basePrice)} onChange={(event) => setForm((current) => ({ ...current, basePrice: parseMoneyInput(event.target.value) }))} disabled={!canWrite} placeholder="500.000" inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" required /></label>
            <label className="block"><span className="text-sm font-medium text-[#334155]">Phí dịch vụ</span><input value={formatMoneyInput(form.serviceFee)} onChange={(event) => setForm((current) => ({ ...current, serviceFee: parseMoneyInput(event.target.value) }))} disabled={!canWrite} placeholder="0" inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
          </div>
          <p className="text-xs leading-5 text-[#667892]">Khi gói có hạng mục “Đã bao gồm”, hệ thống tự lấy tổng giá hạng mục để tính giá gói. Giá nền chỉ dùng khi chưa có hạng mục.</p>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Tóm tắt</span><input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} disabled={!canWrite} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Mô tả</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} disabled={!canWrite} rows={3} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
          <label className="block"><span className="text-sm font-medium text-[#334155]">Ghi chú</span><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} disabled={!canWrite} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
          <div className="space-y-2">{[["isPopular", "Gói nổi bật"], ["isBHYTSupport", "Hỗ trợ BHYT"], ["isActive", "Đang hiển thị"]].map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2"><span className="text-sm font-medium text-[#334155]">{label}</span><input type="checkbox" checked={Boolean(form[key as keyof PackageForm])} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.checked }))} disabled={!canWrite} className="h-4 w-4 accent-[#0d4f8b]" /></label>)}</div>

          {canWrite ? <div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo gói khám"}</button>{editing ? <button type="button" onClick={startCreate} className="rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-medium text-[#42526b] hover:bg-[#f6f8fb]">Hủy</button> : null}</div> : null}
        </form>
        </DashboardWorkspace>
      </aside>
      ) : null}
    </div>
  );
}
