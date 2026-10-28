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
import { useDashboardDoctors, useDashboardDoctorUsers } from "@/lib/dashboard-doctors-query";
import { queryKeys } from "@/lib/query-keys";
import type { DoctorProfile } from "@/lib/types";

type DoctorForm = {
  userId: string;
  departmentId: string;
  title: string;
  specialization: string;
  experience: string;
  consultationFee: string;
  bio: string;
  isAvailable: boolean;
};

const emptyForm: DoctorForm = {
  userId: "",
  departmentId: "",
  title: "",
  specialization: "",
  experience: "",
  consultationFee: "0",
  bio: "",
  isAvailable: true,
};

const availabilityOptions = [
  { label: "Tất cả", value: "" },
  { label: "Sẵn sàng khám", value: "true" },
  { label: "Tạm ngừng", value: "false" },
];

const toForm = (doctor: DoctorProfile): DoctorForm => ({
  userId: doctor.user.id,
  departmentId: doctor.department.id,
  title: doctor.title || "",
  specialization: doctor.specialization || "",
  experience: doctor.experience === null ? "" : String(doctor.experience),
  consultationFee: String(doctor.consultationFee || 0),
  bio: doctor.bio || "",
  isAvailable: doctor.isAvailable,
});

const buildCreatePayload = (form: DoctorForm) => ({
  userId: form.userId,
  departmentId: form.departmentId,
  title: form.title.trim() || null,
  specialization: form.specialization.trim() || null,
  experience: form.experience === "" ? undefined : Number(form.experience),
  consultationFee: form.consultationFee === "" ? undefined : Number(form.consultationFee),
  bio: form.bio.trim() || null,
  isAvailable: form.isAvailable,
});

const buildUpdatePayload = (form: DoctorForm) => ({
  departmentId: form.departmentId,
  title: form.title.trim() || null,
  specialization: form.specialization.trim() || null,
  experience: form.experience === "" ? null : Number(form.experience),
  consultationFee: form.consultationFee === "" ? 0 : Number(form.consultationFee),
  bio: form.bio.trim() || null,
  isAvailable: form.isAvailable,
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatMoneyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
};

const parseMoneyInput = (value: string) => value.replace(/\D/g, "");

export default function DoctorsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isAvailable, setIsAvailable] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [editing, setEditing] = useState<DoctorProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DoctorProfile | null>(null);
  const [form, setForm] = useState<DoctorForm>(emptyForm);
  const listPanelRef = useRef<HTMLElement | null>(null);
  const formPanelRef = useRef<HTMLElement | null>(null);

  const canWrite = user?.role === "ADMIN" || user?.role === "STAFF";
  const canDelete = user?.role === "ADMIN";

  const query = useMemo(
    () => ({
      search: appliedSearch || undefined,
      departmentId: departmentId || undefined,
      isAvailable: isAvailable || undefined,
      page,
      limit: 10,
    }),
    [appliedSearch, departmentId, isAvailable, page],
  );
  const departmentQuery = useMemo(() => ({ isActive: "true", limit: 100 }), []);
  const doctorUsersQuery = useMemo(() => ({ role: "DOCTOR", isActive: "true", limit: 100 }), []);
  const doctorsQuery = useDashboardDoctors(query);
  const departmentsQuery = useDashboardDepartments(departmentQuery);
  const doctorUsersResult = useDashboardDoctorUsers(doctorUsersQuery, user?.role === "ADMIN");
  const loading = doctorsQuery.isLoading;
  const doctors = doctorsQuery.data?.items ?? [];
  const departments = departmentsQuery.data?.items ?? [];
  const doctorUsers = doctorUsersResult.data?.items ?? [];
  const pagination = doctorsQuery.data?.pagination ?? { page, limit: 10, total: 0, totalPages: 1 };
  const queryError = doctorsQuery.error || departmentsQuery.error || doctorUsersResult.error;
  const queryErrorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Không tải được dữ liệu bác sĩ"
    : "";
  const visibleError = error || queryErrorMessage;

  const scrollToForm = () => {
    window.setTimeout(() => {
      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const scrollToList = () => {
    window.setTimeout(() => {
      listPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const invalidateDoctors = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctors"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "users"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "doctors"] }),
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
    setNotice("");
    setError("");
    scrollToForm();
  };

  const startEdit = (doctor: DoctorProfile) => {
    setWorkspaceOpen(true);
    setEditing(doctor);
    setDeleteTarget(null);
    setForm(toForm(doctor));
    setNotice("");
    setError("");
    scrollToForm();
  };

  const startDelete = (doctor: DoctorProfile) => {
    setWorkspaceOpen(true);
    setDeleteTarget(doctor);
    setEditing(null);
    setNotice("");
    setError("");
    scrollToForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editing) {
        await apiRequest<DoctorProfile>(`/dashboard/doctors/${editing.id}`, {
          method: "PATCH",
          body: buildUpdatePayload(form),
        });
        setNotice("Đã cập nhật hồ sơ bác sĩ");
      } else {
        await apiRequest<DoctorProfile>("/dashboard/doctors", {
          method: "POST",
          body: buildCreatePayload(form),
        });
        setNotice("Đã tạo hồ sơ bác sĩ");
      }

      setEditing(null);
      setForm(emptyForm);
      await invalidateDoctors();
      scrollToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được hồ sơ bác sĩ");
    } finally {
      setSaving(false);
    }
  };

  const handleAvailability = async (doctor: DoctorProfile) => {
    if (!canWrite) return;

    setError("");
    setNotice("");

    try {
      await apiRequest<DoctorProfile>(`/dashboard/doctors/${doctor.id}/availability`, {
        method: "PATCH",
        body: { isAvailable: !doctor.isAvailable },
      });
      setNotice(doctor.isAvailable ? "Đã tạm ngừng nhận lịch" : "Đã sẵn sàng nhận lịch");
      await invalidateDoctors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<DoctorProfile>(`/dashboard/doctors/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      setNotice("Đã xóa hồ sơ bác sĩ");
      await invalidateDoctors();
      scrollToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được hồ sơ bác sĩ");
    } finally {
      setSaving(false);
    }
  };

  const doctorUserOptions = doctorUsers.filter((doctorUser) => {
    if (!editing) {
      return !doctors.some((doctor) => doctor.user.id === doctorUser.id);
    }

    return doctorUser.id === editing.user.id || !doctors.some((doctor) => doctor.user.id === doctorUser.id);
  });

  return (
    <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${workspaceOpen && canWrite ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "xl:grid-cols-1"}`}>
      <DashboardFeedback error={visibleError} notice={notice} onDismiss={queryErrorMessage ? undefined : () => { setError(""); setNotice(""); }} />

      <section ref={listPanelRef} className="min-w-0 scroll-mt-24 space-y-4">
        <DashboardPageHeader eyebrow="Dữ liệu nền" title="Bác sĩ" description="Quản lý hồ sơ chuyên môn, chuyên khoa, phí khám và trạng thái nhận lịch."
          actions={canWrite ? <><Button onClick={startCreate} size="lg"><Plus />Tạo hồ sơ</Button>{!workspaceOpen && (editing || deleteTarget) ? <Button variant="outline" size="lg" onClick={() => setWorkspaceOpen(true)}><PanelRightOpen />Mở lại hồ sơ</Button> : null}</> : undefined}
        />

        <DashboardSurface>
          <form onSubmit={applySearch} className="grid gap-3 border-b border-border p-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_220px_170px_auto]">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên, SĐT, học hàm, chuyên môn" />
            <select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              <option value="">Tất cả chuyên khoa</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <select value={isAvailable} onChange={(event) => { setIsAvailable(event.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              {availabilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Button type="submit"><Search />Tìm kiếm</Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[#667892]">
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Bác sĩ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Chuyên khoa</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Chuyên môn</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Phí khám</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Lịch</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[#667892]">Đang tải danh sách...</td></tr>
                ) : doctors.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[#667892]">Chưa có hồ sơ bác sĩ phù hợp</td></tr>
                ) : doctors.map((doctor) => (
                  <tr key={doctor.id} className={`align-top transition-colors ${editing?.id === doctor.id || deleteTarget?.id === doctor.id ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <div className="flex items-center gap-3">
                        {doctor.user.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={doctor.user.avatar} alt={doctor.user.fullName} loading="lazy" decoding="async" className="h-10 w-10 rounded-md object-cover" />
                        ) : <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e7f0fb] text-sm font-semibold text-[#0d4f8b]">{doctor.user.fullName.slice(0, 1).toUpperCase()}</div>}
                        <div>
                          <p className="font-semibold text-[#172033]">{[doctor.title, doctor.user.fullName].filter(Boolean).join(" ")}</p>
                          <p className="mt-1 text-xs text-[#667892]">{doctor.user.phone || doctor.user.email || "Chưa có liên hệ"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{doctor.department.name}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p>{doctor.specialization || "-"}</p><p className="mt-1 text-xs text-[#667892]">{doctor.experience ?? 0} năm kinh nghiệm</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">{formatCurrency(doctor.consultationFee)}</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3 text-[#42526b]">{doctor._count.schedules} lịch / {doctor._count.timeSlots} slot</td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><DashboardStatusBadge tone={doctor.isAvailable ? "positive" : "neutral"}>{doctor.isAvailable ? "Sẵn sàng" : "Tạm ngừng"}</DashboardStatusBadge></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canWrite ? (
                          <>
                            <button onClick={() => startEdit(doctor)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b] hover:bg-[#f6f8fb]">Sửa</button>
                            <button onClick={() => void handleAvailability(doctor)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b] hover:bg-[#f6f8fb]">{doctor.isAvailable ? "Tạm ngừng" : "Mở lại"}</button>
                          </>
                        ) : null}
                        {canDelete ? <button onClick={() => startDelete(doctor)} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e] hover:bg-[#fff3f2]">Xóa</button> : null}
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
          title={editing ? `Hồ sơ ${editing.user.fullName}` : "Công cụ hồ sơ bác sĩ"}
          description="Quản lý chuyên khoa, thông tin chuyên môn, phí khám và trạng thái nhận lịch."
        >
        {deleteTarget ? (
          <div className="mb-5 rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4">
            <h3 className="font-semibold text-[#b3261e]">Xác nhận xóa hồ sơ bác sĩ</h3>
            <p className="mt-2 text-sm text-[#5f2630]">{deleteTarget.user.fullName}</p>
            <div className="mt-3 flex gap-2">
              <button disabled={saving} onClick={() => void handleDelete()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xóa</button>
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Hủy</button>
            </div>
          </div>
        ) : null}

        <h3 className="text-lg font-semibold">{editing ? "Cập nhật hồ sơ bác sĩ" : "Tạo hồ sơ bác sĩ"}</h3>
        <p className="mt-2 text-sm leading-6 text-[#667892]">
          {editing ? "Tài khoản bác sĩ đã gắn với hồ sơ nên không đổi userId tại đây." : "Chọn tài khoản role DOCTOR đã có trong nhóm nhân sự, sau đó gắn chuyên khoa và thông tin chuyên môn."}
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-[#334155]">Tài khoản bác sĩ</span>
            {editing ? (
              <input value={`${editing.user.fullName} (${editing.user.phone || editing.user.email || editing.user.id})`} disabled className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-[#f6f8fb] px-3 py-2 text-sm text-[#667892]" />
            ) : user?.role === "ADMIN" ? (
              <select value={form.userId} onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))} disabled={!canWrite} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" required>
                <option value="">Chọn tài khoản DOCTOR</option>
                {doctorUserOptions.map((doctorUser) => <option key={doctorUser.id} value={doctorUser.id}>{doctorUser.fullName} - {doctorUser.phone || doctorUser.email || doctorUser.id}</option>)}
              </select>
            ) : (
              <input value={form.userId} onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))} disabled={!canWrite} placeholder="Nhập userId role DOCTOR" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" required />
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#334155]">Chuyên khoa</span>
            <select value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))} disabled={!canWrite} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" required>
              <option value="">Chọn chuyên khoa</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-medium text-[#334155]">Học hàm / chức danh</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} disabled={!canWrite} placeholder="BS.CKII" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
            <label className="block"><span className="text-sm font-medium text-[#334155]">Năm kinh nghiệm</span><input value={form.experience} onChange={(event) => setForm((current) => ({ ...current, experience: event.target.value.replace(/\D/g, "") }))} disabled={!canWrite} inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>
          </div>

          <label className="block"><span className="text-sm font-medium text-[#334155]">Chuyên môn</span><input value={form.specialization} onChange={(event) => setForm((current) => ({ ...current, specialization: event.target.value }))} disabled={!canWrite} placeholder="Tim mạch, nội tổng quát..." className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>

          <label className="block">
            <span className="text-sm font-medium text-[#334155]">Phí khám</span>
            <input value={formatMoneyInput(form.consultationFee)} onChange={(event) => setForm((current) => ({ ...current, consultationFee: parseMoneyInput(event.target.value) }))} disabled={!canWrite} inputMode="numeric" placeholder="150.000" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" required />
            <p className="mt-1 text-xs text-[#667892]">{form.consultationFee ? `Tương đương ${formatCurrency(Number(form.consultationFee))}` : "Ví dụ: 150.000 VND"}</p>
          </label>

          <label className="block"><span className="text-sm font-medium text-[#334155]">Giới thiệu</span><textarea value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} disabled={!canWrite} rows={4} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" /></label>

          <label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2"><span className="text-sm font-medium text-[#334155]">Sẵn sàng nhận lịch</span><input type="checkbox" checked={form.isAvailable} onChange={(event) => setForm((current) => ({ ...current, isAvailable: event.target.checked }))} disabled={!canWrite} className="h-4 w-4 accent-[#0d4f8b]" /></label>

          {canWrite ? (
            <div className="flex gap-2">
              <button disabled={saving} className="flex-1 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo hồ sơ"}</button>
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
