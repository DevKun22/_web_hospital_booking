"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PanelRightOpen, Search } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardPageHeader, DashboardStatusBadge, DashboardSurface } from "@/components/dashboard/dashboard-ui";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  fetchDashboardPrescription,
  useDashboardPrescription,
  useDashboardPrescriptionDoctors,
  useDashboardPrescriptions,
} from "@/lib/dashboard-prescriptions-query";
import { queryKeys } from "@/lib/query-keys";
import { formatVietnamDateTime } from "@/lib/date";
import type {
  DoctorProfile,
  Prescription,
  PrescriptionItem,
  PrescriptionStatus,
} from "@/lib/types";

type ItemForm = {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  unit: string;
  instruction: string;
  sortOrder: string;
};

const emptyItemForm: ItemForm = {
  medicineName: "",
  dosage: "",
  frequency: "",
  duration: "",
  quantity: "",
  unit: "",
  instruction: "",
  sortOrder: "0",
};

const statusOptions: { value: "" | PrescriptionStatus; label: string }[] = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "DRAFT", label: "Bản nháp" },
  { value: "ISSUED", label: "Đã phát hành" },
  { value: "CANCELLED", label: "Đã huỷ" },
];

const statusLabel: Record<PrescriptionStatus, string> = {
  DRAFT: "Bản nháp",
  ISSUED: "Đã phát hành",
  CANCELLED: "Đã huỷ",
};

const statusTone: Record<PrescriptionStatus, "warning" | "positive" | "danger"> = {
  DRAFT: "warning",
  ISSUED: "positive",
  CANCELLED: "danger",
};

const doctorName = (doctor: DoctorProfile | Prescription["doctor"]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const toItemForm = (item: PrescriptionItem): ItemForm => ({
  medicineName: item.medicineName,
  dosage: item.dosage || "",
  frequency: item.frequency || "",
  duration: item.duration || "",
  quantity: item.quantity === null ? "" : String(item.quantity),
  unit: item.unit || "",
  instruction: item.instruction || "",
  sortOrder: String(item.sortOrder || 0),
});

const buildItemPayload = (form: ItemForm) => ({
  medicineName: form.medicineName.trim(),
  dosage: form.dosage.trim() || null,
  frequency: form.frequency.trim() || null,
  duration: form.duration.trim() || null,
  quantity: form.quantity ? Number(form.quantity) : null,
  unit: form.unit.trim() || null,
  instruction: form.instruction.trim() || null,
  sortOrder: Number(form.sortOrder || 0),
});

export default function PrescriptionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [prescriptionCode, setPrescriptionCode] = useState("");
  const [medicalRecordId, setMedicalRecordId] = useState("");
  const [appliedPrescriptionCode, setAppliedPrescriptionCode] = useState("");
  const [appliedMedicalRecordId, setAppliedMedicalRecordId] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [selectedSnapshot, setSelected] = useState<Prescription | null>(null);
  const [createRecordId, setCreateRecordId] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [note, setNote] = useState("");
  const [editingItem, setEditingItem] = useState<PrescriptionItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<PrescriptionItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const listRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);

  const canEdit = user?.role === "ADMIN" || user?.role === "DOCTOR";
  const canCancel = user?.role === "ADMIN" || user?.role === "DOCTOR";
  const isDoctor = user?.role === "DOCTOR";

  const query = useMemo(
    () => ({
      status: status || undefined,
      doctorId: isDoctor ? undefined : doctorId || undefined,
      prescriptionCode: appliedPrescriptionCode || undefined,
      medicalRecordId: appliedMedicalRecordId || undefined,
      page,
      limit: 20,
    }),
    [appliedMedicalRecordId, appliedPrescriptionCode, doctorId, isDoctor, page, status],
  );
  const doctorQuery = useMemo(() => ({ limit: 100 }), []);
  const prescriptionsQuery = useDashboardPrescriptions(query);
  const doctorsQuery = useDashboardPrescriptionDoctors(doctorQuery, !isDoctor);
  const selectedPrescriptionQuery = useDashboardPrescription(selectedSnapshot?.id);
  const loading = prescriptionsQuery.isLoading;
  const prescriptions = prescriptionsQuery.data?.items ?? [];
  const doctors = doctorsQuery.data?.items ?? [];
  const pagination = prescriptionsQuery.data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const selected = selectedPrescriptionQuery.data ?? selectedSnapshot;
  const queryError = prescriptionsQuery.error || doctorsQuery.error || selectedPrescriptionQuery.error;
  const queryErrorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Không tải được dữ liệu đơn thuốc"
    : "";
  const visibleError = error || queryErrorMessage;

  const invalidatePrescriptions = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardPrescriptions }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "medical-records"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "appointments"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardOverview }),
    ]);
  };

  const refreshSelectedPrescription = async (id: string) => {
    const refreshed = await queryClient.fetchQuery({
      queryKey: queryKeys.dashboardPrescription(id),
      queryFn: () => fetchDashboardPrescription(id),
    });
    setSelected(refreshed);
    setNote(refreshed.note || "");
    return refreshed;
  };

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const scrollDetail = () => {
    window.setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const scrollList = () => {
    window.setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const setQuickFilter = (nextStatus: "" | PrescriptionStatus) => {
    setStatus(nextStatus);
    setPrescriptionCode("");
    setMedicalRecordId("");
    setAppliedPrescriptionCode("");
    setAppliedMedicalRecordId("");
    setPage(1);
    scrollList();
  };

  const doctorSummary = {
    total: prescriptions.length,
    draft: prescriptions.filter((item) => item.status === "DRAFT").length,
    issued: prescriptions.filter((item) => item.status === "ISSUED").length,
    emptyDraft: prescriptions.filter((item) => item.status === "DRAFT" && item.items.length === 0).length,
  };

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedPrescriptionCode(prescriptionCode.trim());
    setAppliedMedicalRecordId(medicalRecordId.trim());
    setPage(1);
  };

  const openDetail = (prescription: Prescription) => {
    setSelected(prescription);
    setWorkspaceOpen(true);
    setNote(prescription.note || "");
    setEditingItem(null);
    setDeleteItemTarget(null);
    setItemForm({ ...emptyItemForm, sortOrder: String(prescription.items.length) });
    scrollDetail();
  };

  const createPrescription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await apiRequest<Prescription>(
        `/dashboard/medical-records/${createRecordId}/prescription`,
        {
          method: "POST",
          body: { note: createNote.trim() || null, items: [] },
        },
      );
      setSelected(created);
      setNote(created.note || "");
      setCreateRecordId("");
      setCreateNote("");
      setNotice("Đã tạo đơn thuốc");
      await invalidatePrescriptions();
      scrollDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được đơn thuốc");
    } finally {
      setBusy(false);
    }
  };

  const updateNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Prescription>(`/dashboard/prescriptions/${selected.id}`, {
        method: "PATCH",
        body: { note: note.trim() || null },
      });
      setSelected(updated);
      setNote(updated.note || "");
      setNotice("Đã cập nhật ghi chú đơn");
      await invalidatePrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được đơn thuốc");
    } finally {
      setBusy(false);
    }
  };

  const simpleAction = async (prescription: Prescription, path: string, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Prescription>(`/dashboard/prescriptions/${prescription.id}${path}`, {
        method: "PATCH",
      });
      setSelected(updated);
      setNote(updated.note || "");
      setEditingItem(null);
      setDeleteItemTarget(null);
      setNotice(message);
      await invalidatePrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thực hiện được thao tác");
    } finally {
      setBusy(false);
    }
  };

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<Prescription>(
        editingItem
          ? `/dashboard/prescriptions/${selected.id}/items/${editingItem.id}`
          : `/dashboard/prescriptions/${selected.id}/items`,
        {
          method: editingItem ? "PATCH" : "POST",
          body: buildItemPayload(itemForm),
        },
      );
      setSelected(updated);
      setEditingItem(null);
      setDeleteItemTarget(null);
      setItemForm({ ...emptyItemForm, sortOrder: String(updated.items.length) });
      setNotice(editingItem ? "Đã cập nhật thuốc" : "Đã thêm thuốc");
      await invalidatePrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được thuốc");
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async () => {
    if (!selected || !canEdit || !deleteItemTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<PrescriptionItem>(`/dashboard/prescriptions/${selected.id}/items/${deleteItemTarget.id}`, {
        method: "DELETE",
      });
      await refreshSelectedPrescription(selected.id);
      setDeleteItemTarget(null);
      setNotice("Đã xoá thuốc");
      await invalidatePrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được thuốc");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${workspaceOpen ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "xl:grid-cols-1"}`}>
      <DashboardFeedback error={visibleError} notice={notice} onDismiss={queryErrorMessage ? undefined : () => { setError(""); setNotice(""); }} />

      <section ref={listRef} className="min-w-0 scroll-mt-24 space-y-4">
        <DashboardPageHeader eyebrow={isDoctor ? "Khu làm việc bác sĩ" : "Chuyên môn"} title="Đơn thuốc"
          description={isDoctor ? "Hoàn thiện đơn nháp, kiểm tra thuốc và phát hành đơn cho bệnh nhân." : "Tạo đơn từ hồ sơ khám, quản lý thuốc và theo dõi trạng thái phát hành."}
          actions={!workspaceOpen ? <Button variant="outline" size="lg" onClick={() => setWorkspaceOpen(true)}><PanelRightOpen />{canEdit ? "Mở công cụ đơn thuốc" : "Mở đơn đang chọn"}</Button> : undefined}
        />

        {isDoctor ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" onClick={() => setQuickFilter("")} className="rounded-md border border-[#cfe4fa] bg-[#f3f8ff] p-4 text-left text-[#0d4f8b] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Đơn đang lọc</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.total}</p>
              <p className="mt-1 text-xs opacity-75">Toàn bộ đơn thuốc</p>
            </button>
            <button type="button" onClick={() => setQuickFilter("DRAFT")} className="rounded-md border border-[#f4d7a1] bg-[#fff8eb] p-4 text-left text-[#946200] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Đơn nháp</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.draft}</p>
              <p className="mt-1 text-xs opacity-75">Cần kiểm tra trước khi phát hành</p>
            </button>
            <button type="button" onClick={() => setQuickFilter("DRAFT")} className="rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4 text-left text-[#b3261e] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Chưa có thuốc</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.emptyDraft}</p>
              <p className="mt-1 text-xs opacity-75">Cần thêm ít nhất 1 thuốc</p>
            </button>
            <button type="button" onClick={() => setQuickFilter("ISSUED")} className="rounded-md border border-[#c7ead0] bg-[#f0fff4] p-4 text-left text-[#1f7a3a] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Đã phát hành</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.issued}</p>
              <p className="mt-1 text-xs opacity-75">Sẵn sàng gửi cho bệnh nhân</p>
            </button>
          </div>
        ) : null}

        <DashboardSurface>
          <form onSubmit={applySearch} className={`grid gap-3 border-b border-border p-4 ${isDoctor ? "lg:grid-cols-2 2xl:grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)_auto]" : "lg:grid-cols-2 2xl:grid-cols-[170px_minmax(0,1fr)_170px_170px_auto]"}`}>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {!isDoctor ? (
              <select value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                <option value="">Tất cả bác sĩ</option>
                {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorName(doctor)}</option>)}
              </select>
            ) : null}
            <Input value={prescriptionCode} onChange={(e) => setPrescriptionCode(e.target.value)} placeholder="Mã đơn" />
            <Input value={medicalRecordId} onChange={(e) => setMedicalRecordId(e.target.value)} placeholder="Mã hồ sơ hoặc mã định danh" />
            <Button type="submit"><Search />Tìm kiếm</Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[#667892]">
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Đơn thuốc</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Bệnh nhân</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Hồ sơ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Bác sĩ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Đang tải đơn thuốc...</td></tr>
                ) : prescriptions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Chưa có đơn thuốc phù hợp</td></tr>
                ) : prescriptions.map((prescription) => (
                  <tr key={prescription.id} className="align-top">
                    <td className="border-b border-[#eef2f7] px-4 py-3"><button onClick={() => openDetail(prescription)} className="font-semibold text-[#0d4f8b] hover:underline">{prescription.prescriptionCode}</button><p className="mt-1 text-xs text-[#667892]">{prescription.items.length} thuốc</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p className="font-semibold">{prescription.patient.fullName}</p><p className="mt-1 text-xs text-[#667892]">{prescription.patient.phone}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p>{prescription.medicalRecord.recordCode}</p><p className="mt-1 text-xs text-[#667892]">{prescription.medicalRecord.diagnosis || "Chưa có chẩn đoán"}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p>{doctorName(prescription.doctor)}</p><p className="mt-1 text-xs text-[#667892]">{prescription.doctor.department.name}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><DashboardStatusBadge tone={statusTone[prescription.status]}>{statusLabel[prescription.status]}</DashboardStatusBadge></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => openDetail(prescription)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Chi tiết</button>
                        {canEdit && prescription.status === "DRAFT" ? (
                          <button type="button" disabled={busy} onClick={() => void simpleAction(prescription, "/issue", "Đã phát hành đơn")} className="rounded-md border border-[#cfe4fa] px-3 py-1.5 text-xs font-medium text-[#0d4f8b] disabled:opacity-60">Phát hành</button>
                        ) : null}
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

      {workspaceOpen ? (
      <aside ref={detailRef} className="min-w-0 scroll-mt-24">
        <DashboardWorkspace
          open={workspaceOpen}
          onOpenChange={setWorkspaceOpen}
          title={selected ? `Đơn thuốc ${selected.prescriptionCode}` : "Công cụ đơn thuốc"}
          description="Tạo, kiểm tra và phát hành đơn thuốc trong một vùng làm việc tập trung."
        >
        <div className="space-y-4">
        {canEdit ? (
          <section className="rounded-md border border-[#dce3ee] bg-white p-5">
            <h3 className="text-lg font-semibold">Tạo đơn thuốc</h3>
            <p className="mt-2 text-sm text-[#667892]">Nhập mã hồ sơ hiển thị trên bảng hoặc mã định danh. Hồ sơ phải thuộc ca đang khám hoặc đã hoàn thành và chưa có đơn thuốc.</p>
            <form className="mt-4 space-y-3" onSubmit={createPrescription}>
              <input value={createRecordId} onChange={(e) => setCreateRecordId(e.target.value)} placeholder="Mã hồ sơ hoặc mã định danh" className="w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
              <textarea value={createNote} onChange={(e) => setCreateNote(e.target.value)} placeholder="Ghi chú đơn" rows={2} className="w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
              <button disabled={busy} className="w-full rounded-md bg-[#0d4f8b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Đang tạo..." : "Tạo đơn"}</button>
            </form>
          </section>
        ) : null}

        <section className="rounded-md border border-[#dce3ee] bg-white p-5">
          {selected ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-[#55708f]">Chi tiết đơn thuốc</p>
                <h3 className="mt-1 text-xl font-semibold">{selected.prescriptionCode}</h3>
                <DashboardStatusBadge tone={statusTone[selected.status]} className="mt-3">{statusLabel[selected.status]}</DashboardStatusBadge>
              </div>
              <div className="rounded-md border border-[#e5ebf3] p-3 text-sm">
                <p className="font-semibold">{selected.patient.fullName}</p>
                <p className="text-[#667892]">{selected.patient.phone || "-"} · {selected.medicalRecord.recordCode}</p>
                <p className="mt-1 text-[#667892]">{doctorName(selected.doctor)}</p>
                <Link href={`/dashboard/medical-records?recordCode=${encodeURIComponent(selected.medicalRecord.recordCode)}`} className="mt-2 inline-flex rounded-md border border-[#cfe4fa] px-2 py-1 text-xs font-medium text-[#0d4f8b]">Mở hồ sơ khám</Link>
              </div>

              <div className="grid gap-2 rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-3 text-xs text-[#667892] sm:grid-cols-2">
                <p>Tạo lúc: <span className="font-medium text-[#42526b]">{formatVietnamDateTime(selected.createdAt)}</span></p>
                <p>Cập nhật: <span className="font-medium text-[#42526b]">{formatVietnamDateTime(selected.updatedAt)}</span></p>
                {selected.issuedAt ? <p>Phát hành: <span className="font-medium text-[#1f7a3a]">{formatVietnamDateTime(selected.issuedAt)}</span></p> : null}
                {selected.cancelledAt ? <p>Hủy lúc: <span className="font-medium text-[#b3261e]">{formatVietnamDateTime(selected.cancelledAt)}</span></p> : null}
              </div>

              <form className="space-y-3" onSubmit={updateNote}>
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">Ghi chú đơn</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={!canEdit || selected.status !== "DRAFT"} rows={3} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f6f8fb]" />
                </label>
                <div className="flex flex-wrap gap-2">
                  {canEdit && selected.status === "DRAFT" ? <button disabled={busy} className="rounded-md bg-[#0d4f8b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Lưu ghi chú</button> : null}
                  {canEdit && selected.status === "DRAFT" ? <button type="button" disabled={busy} onClick={() => void simpleAction(selected, "/issue", "Đã phát hành đơn")} className="rounded-md border border-[#cfd8e6] px-4 py-2 text-sm font-medium text-[#42526b]">Phát hành</button> : null}
                  {canCancel && selected.status !== "CANCELLED" ? <button type="button" disabled={busy} onClick={() => void simpleAction(selected, "/cancel", "Đã huỷ đơn thuốc")} className="rounded-md border border-[#f2b8b5] px-4 py-2 text-sm font-medium text-[#b3261e]">Huỷ đơn</button> : null}
                </div>
              </form>

              <section className="border-t border-[#e5ebf3] pt-5">
                <h4 className="font-semibold">Thuốc trong đơn</h4>
                <div className="mt-3 space-y-2">
                  {selected.items.length === 0 ? <p className="text-sm text-[#667892]">Chưa có thuốc</p> : selected.items.map((item) => (
                    <div key={item.id} className="rounded-md border border-[#e5ebf3] p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.medicineName}</p>
                          <p className="text-[#667892]">{item.dosage || "-"} · {item.frequency || "-"} · {item.duration || "-"}</p>
                          <p className="text-xs text-[#667892]">Số lượng: {item.quantity ?? "-"} {item.unit || ""}</p>
                          <p className="mt-1">{item.instruction || ""}</p>
                        </div>
                        {canEdit && selected.status === "DRAFT" ? (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setEditingItem(item); setDeleteItemTarget(null); setItemForm(toItemForm(item)); }} className="rounded-md border border-[#cfd8e6] px-2 py-1 text-xs text-[#42526b]">Sửa</button>
                            <button type="button" onClick={() => { setDeleteItemTarget(item); setEditingItem(null); }} className="rounded-md border border-[#f2b8b5] px-2 py-1 text-xs text-[#b3261e]">Xoá</button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                {deleteItemTarget ? (
                  <div className="mt-3 rounded-md border border-[#f2d4d2] bg-[#fff8f7] p-3 text-sm">
                    <p className="font-semibold text-[#8f1d18]">Xoá thuốc khỏi đơn?</p>
                    <p className="mt-1 text-[#667892]">{deleteItemTarget.medicineName}</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => setDeleteItemTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Giữ lại</button>
                      <button type="button" disabled={busy} onClick={() => void deleteItem()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xoá thuốc</button>
                    </div>
                  </div>
                ) : null}

                {canEdit && selected.status === "DRAFT" ? (
                  <form className="mt-4 space-y-3 rounded-md border border-[#e5ebf3] p-3" onSubmit={saveItem}>
                    <h5 className="font-semibold">{editingItem ? "Sửa thuốc" : "Thêm thuốc"}</h5>
                    <input value={itemForm.medicineName} onChange={(e) => setItemForm((current) => ({ ...current, medicineName: e.target.value }))} placeholder="Tên thuốc" className="w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={itemForm.dosage} onChange={(e) => setItemForm((current) => ({ ...current, dosage: e.target.value }))} placeholder="Liều dùng" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      <input value={itemForm.frequency} onChange={(e) => setItemForm((current) => ({ ...current, frequency: e.target.value }))} placeholder="Tần suất" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      <input value={itemForm.duration} onChange={(e) => setItemForm((current) => ({ ...current, duration: e.target.value }))} placeholder="Thời gian" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      <input value={itemForm.quantity} onChange={(e) => setItemForm((current) => ({ ...current, quantity: e.target.value.replace(/\D/g, "") }))} placeholder="Số lượng" inputMode="numeric" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      <input value={itemForm.unit} onChange={(e) => setItemForm((current) => ({ ...current, unit: e.target.value }))} placeholder="Đơn vị" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                      <input value={itemForm.sortOrder} onChange={(e) => setItemForm((current) => ({ ...current, sortOrder: e.target.value.replace(/\D/g, "") }))} placeholder="Thứ tự" inputMode="numeric" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                    </div>
                    <textarea value={itemForm.instruction} onChange={(e) => setItemForm((current) => ({ ...current, instruction: e.target.value }))} placeholder="Hướng dẫn dùng thuốc" rows={2} className="w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                    <div className="flex gap-2">
                      <button disabled={busy} className="flex-1 rounded-md bg-[#0d4f8b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Đang lưu..." : editingItem ? "Lưu thuốc" : "Thêm thuốc"}</button>
                      {editingItem ? <button type="button" onClick={() => { setEditingItem(null); setItemForm({ ...emptyItemForm, sortOrder: String(selected.items.length) }); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Huỷ</button> : null}
                    </div>
                  </form>
                ) : null}
              </section>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-[#55708f]">Chi tiết đơn thuốc</p>
              <h3 className="mt-1 text-xl font-semibold">Chọn một đơn thuốc</h3>
              <p className="mt-2 text-sm leading-6 text-[#667892]">Bấm vào mã đơn để xem và chỉnh sửa thuốc trong đơn.</p>
            </div>
          )}
        </section>
        </div>
        </DashboardWorkspace>
      </aside>
      ) : null}
    </div>
  );
}
