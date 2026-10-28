"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PanelRightOpen, Search } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardPageHeader, DashboardStatusBadge, DashboardSurface } from "@/components/dashboard/dashboard-ui";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest, uploadImages } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  fetchDashboardMedicalRecord,
  useDashboardMedicalRecord,
  useDashboardMedicalRecordDoctors,
  useDashboardMedicalRecords,
} from "@/lib/dashboard-medical-records-query";
import { formatVietnamDate, getVietnamDateInput } from "@/lib/date";
import { queryKeys } from "@/lib/query-keys";
import type {
  DoctorProfile,
  LabResult,
  MedicalRecord,
  MedicalResultStatus,
} from "@/lib/types";

type RecordForm = {
  symptoms: string;
  diagnosis: string;
  treatment: string;
  prescription: string;
  doctorNotes: string;
  resultPdfUrl: string;
};

type LabForm = {
  testName: string;
  resultValue: string;
  unit: string;
  referenceRange: string;
  conclusion: string;
  fileUrl: string;
};

const emptyRecordForm: RecordForm = {
  symptoms: "",
  diagnosis: "",
  treatment: "",
  prescription: "",
  doctorNotes: "",
  resultPdfUrl: "",
};

const emptyLabForm: LabForm = {
  testName: "",
  resultValue: "",
  unit: "",
  referenceRange: "",
  conclusion: "",
  fileUrl: "",
};

const statusOptions: { value: "" | MedicalResultStatus; label: string }[] = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "DRAFT", label: "Bản nháp" },
  { value: "PUBLISHED", label: "Đã công bố" },
  { value: "ARCHIVED", label: "Đã lưu trữ" },
];

const statusLabel: Record<MedicalResultStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã công bố",
  ARCHIVED: "Đã lưu trữ",
};

const statusTone: Record<MedicalResultStatus, "warning" | "positive" | "neutral"> = {
  DRAFT: "warning",
  PUBLISHED: "positive",
  ARCHIVED: "neutral",
};

const today = () => getVietnamDateInput();

const formatDate = (value: string) => formatVietnamDate(value);

const doctorName = (doctor: DoctorProfile | MedicalRecord["doctor"]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const toRecordForm = (record: MedicalRecord): RecordForm => ({
  symptoms: record.symptoms || "",
  diagnosis: record.diagnosis || "",
  treatment: record.treatment || "",
  prescription: record.prescription || "",
  doctorNotes: record.doctorNotes || "",
  resultPdfUrl: record.resultPdfUrl || "",
});

const toLabForm = (lab: LabResult): LabForm => ({
  testName: lab.testName,
  resultValue: lab.resultValue || "",
  unit: lab.unit || "",
  referenceRange: lab.referenceRange || "",
  conclusion: lab.conclusion || "",
  fileUrl: lab.fileUrl || "",
});

const buildRecordPayload = (form: RecordForm) => ({
  symptoms: form.symptoms.trim() || null,
  diagnosis: form.diagnosis.trim() || null,
  treatment: form.treatment.trim() || null,
  prescription: form.prescription.trim() || null,
  doctorNotes: form.doctorNotes.trim() || null,
  resultPdfUrl: form.resultPdfUrl.trim() || null,
});

const buildLabPayload = (form: LabForm) => ({
  testName: form.testName.trim(),
  resultValue: form.resultValue.trim() || null,
  unit: form.unit.trim() || null,
  referenceRange: form.referenceRange.trim() || null,
  conclusion: form.conclusion.trim() || null,
  fileUrl: form.fileUrl.trim() || null,
});

export default function MedicalRecordsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(today());
  const [recordCode, setRecordCode] = useState("");
  const [appliedRecordCode, setAppliedRecordCode] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [uploadingRecordFile, setUploadingRecordFile] = useState(false);
  const [uploadingLabFile, setUploadingLabFile] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [selectedSnapshot, setSelected] = useState<MedicalRecord | null>(null);
  const [recordForm, setRecordForm] = useState<RecordForm>(emptyRecordForm);
  const [editingLab, setEditingLab] = useState<LabResult | null>(null);
  const [deleteLabTarget, setDeleteLabTarget] = useState<LabResult | null>(null);
  const [labForm, setLabForm] = useState<LabForm>(emptyLabForm);
  const listRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);

  const canArchive = user?.role === "ADMIN" || user?.role === "STAFF";
  const isDoctor = user?.role === "DOCTOR";
  const canCreatePrescription = user?.role === "ADMIN" || user?.role === "DOCTOR";

  const query = useMemo(
    () => ({
      status: status || undefined,
      doctorId: isDoctor ? undefined : doctorId || undefined,
      date: date || undefined,
      recordCode: appliedRecordCode || undefined,
      page,
      limit: 20,
    }),
    [appliedRecordCode, date, doctorId, isDoctor, page, status],
  );
  const doctorQuery = useMemo(() => ({ limit: 100 }), []);
  const recordsQuery = useDashboardMedicalRecords(query);
  const doctorsQuery = useDashboardMedicalRecordDoctors(doctorQuery, !isDoctor);
  const selectedRecordQuery = useDashboardMedicalRecord(selectedSnapshot?.id);
  const loading = recordsQuery.isLoading;
  const records = recordsQuery.data?.items ?? [];
  const doctors = doctorsQuery.data?.items ?? [];
  const pagination = recordsQuery.data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const selected = selectedRecordQuery.data ?? selectedSnapshot;
  const queryError = recordsQuery.error || doctorsQuery.error || selectedRecordQuery.error;
  const queryErrorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Không tải được dữ liệu hồ sơ khám"
    : "";
  const visibleError = error || queryErrorMessage;

  useEffect(() => {
    const linkedRecordCode = searchParams.get("recordCode")?.trim().toUpperCase();
    if (!linkedRecordCode) return;

    const timeoutId = window.setTimeout(() => {
      setRecordCode(linkedRecordCode);
      setAppliedRecordCode(linkedRecordCode);
      setDate("");
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  const invalidateMedicalRecords = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "medical-records"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardPrescriptions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAppointments() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardOverview }),
    ]);
  };

  const refreshSelectedRecord = async (id: string) => {
    const refreshed = await queryClient.fetchQuery({
      queryKey: queryKeys.dashboardMedicalRecord(id),
      queryFn: () => fetchDashboardMedicalRecord(id),
    });
    setSelected(refreshed);
    setRecordForm(toRecordForm(refreshed));
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

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const setQuickFilter = (nextStatus: "" | MedicalResultStatus, nextDate = today()) => {
    setStatus(nextStatus);
    setDate(nextDate);
    setRecordCode("");
    setAppliedRecordCode("");
    setPage(1);
    scrollTo(listRef);
  };

  const doctorSummary = {
    total: records.length,
    draft: records.filter((record) => record.status === "DRAFT").length,
    publishable: records.filter((record) => record.status === "DRAFT" && ["IN_PROGRESS", "COMPLETED"].includes(record.appointment.status)).length,
    published: records.filter((record) => record.status === "PUBLISHED").length,
    needPrescription: records.filter((record) => !record.prescriptionRecord && ["IN_PROGRESS", "COMPLETED"].includes(record.appointment.status)).length,
  };

  const applyRecordSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedRecordCode(recordCode.trim());
    setPage(1);
  };

  const openDetail = (record: MedicalRecord) => {
    setSelected(record);
    setWorkspaceOpen(true);
    setRecordForm(toRecordForm(record));
    setEditingLab(null);
    setDeleteLabTarget(null);
    setLabForm(emptyLabForm);
    scrollTo(detailRef);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<MedicalRecord>(`/dashboard/medical-records/${selected.id}`, {
        method: "PATCH",
        body: buildRecordPayload(recordForm),
      });
      setSelected(updated);
      setRecordForm(toRecordForm(updated));
      setNotice("Đã cập nhật hồ sơ khám");
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được hồ sơ khám");
    } finally {
      setBusy(false);
    }
  };

  const uploadRecordResultFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingRecordFile(true);
    setError("");
    setNotice("");
    try {
      const [asset] = await uploadImages([file], "medical-results");
      if (!asset) {
        throw new Error("Đã tải lên nhưng không nhận được đường dẫn tệp");
      }
      setRecordForm((current) => ({ ...current, resultPdfUrl: asset.url }));
      setNotice("Đã tải tệp kết quả lên");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tệp kết quả lên");
    } finally {
      setUploadingRecordFile(false);
    }
  };

  const uploadLabResultFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingLabFile(true);
    setError("");
    setNotice("");
    try {
      const [asset] = await uploadImages([file], "medical-results");
      if (!asset) {
        throw new Error("Đã tải lên nhưng không nhận được đường dẫn tệp");
      }
      setLabForm((current) => ({ ...current, fileUrl: asset.url }));
      setNotice("Đã tải tệp cận lâm sàng lên");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tệp cận lâm sàng lên");
    } finally {
      setUploadingLabFile(false);
    }
  };

  const simpleRecordAction = async (record: MedicalRecord, path: string, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<MedicalRecord>(`/dashboard/medical-records/${record.id}${path}`, {
        method: "PATCH",
      });
      setSelected(updated);
      setRecordForm(toRecordForm(updated));
      setNotice(message);
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thực hiện được thao tác");
    } finally {
      setBusy(false);
    }
  };

  const createPrescriptionFromRecord = async (record: MedicalRecord) => {
    if (!canCreatePrescription) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await apiRequest(`/dashboard/medical-records/${record.id}/prescription`, {
        method: "POST",
        body: {
          note: recordForm.prescription.trim() || recordForm.doctorNotes.trim() || null,
          items: [],
        },
      });
      await refreshSelectedRecord(record.id);
      setNotice("Đã tạo đơn thuốc nháp từ hồ sơ");
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được đơn thuốc từ hồ sơ");
    } finally {
      setBusy(false);
    }
  };

  const saveLabResult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editingLab) {
        await apiRequest<LabResult>(
          `/dashboard/medical-records/${selected.id}/lab-results/${editingLab.id}`,
          { method: "PATCH", body: buildLabPayload(labForm) },
        );
        setNotice("Đã cập nhật kết quả cận lâm sàng");
      } else {
        await apiRequest<LabResult>(`/dashboard/medical-records/${selected.id}/lab-results`, {
          method: "POST",
          body: buildLabPayload(labForm),
        });
        setNotice("Đã thêm kết quả cận lâm sàng");
      }
      setEditingLab(null);
      setDeleteLabTarget(null);
      setLabForm(emptyLabForm);
      await refreshSelectedRecord(selected.id);
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được kết quả cận lâm sàng");
    } finally {
      setBusy(false);
    }
  };

  const deleteLabResult = async () => {
    if (!selected || !deleteLabTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<LabResult>(`/dashboard/medical-records/${selected.id}/lab-results/${deleteLabTarget.id}`, {
        method: "DELETE",
      });
      setNotice("Đã xoá kết quả cận lâm sàng");
      setDeleteLabTarget(null);
      await refreshSelectedRecord(selected.id);
      await invalidateMedicalRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được kết quả cận lâm sàng");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${workspaceOpen ? "xl:grid-cols-[minmax(0,1fr)_430px]" : "xl:grid-cols-1"}`}>
      <DashboardFeedback error={visibleError} notice={notice} onDismiss={queryErrorMessage ? undefined : () => { setError(""); setNotice(""); }} />

      <section ref={listRef} className="min-w-0 scroll-mt-24 space-y-4">
        <DashboardPageHeader eyebrow={isDoctor ? "Khu làm việc bác sĩ" : "Chuyên môn"} title="Hồ sơ khám"
          description={isDoctor ? "Hoàn thiện hồ sơ trong ca khám, bổ sung kết quả cận lâm sàng, kê đơn và công bố kết quả." : "Theo dõi chẩn đoán, điều trị, kết quả cận lâm sàng và trạng thái công bố."}
          actions={selected && !workspaceOpen ? <Button variant="outline" size="lg" onClick={() => setWorkspaceOpen(true)}><PanelRightOpen />Mở hồ sơ đang chọn</Button> : undefined}
        />

        {isDoctor ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" onClick={() => setQuickFilter("", today())} className="rounded-md border border-[#cfe4fa] bg-[#f3f8ff] p-4 text-left text-[#0d4f8b] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Hồ sơ đang lọc</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.total}</p>
              <p className="mt-1 text-xs opacity-75">Toàn bộ hồ sơ trong ngày</p>
            </button>
            <button type="button" onClick={() => setQuickFilter("DRAFT", today())} className="rounded-md border border-[#f4d7a1] bg-[#fff8eb] p-4 text-left text-[#946200] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Hồ sơ nháp</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.draft}</p>
              <p className="mt-1 text-xs opacity-75">Cần nhập hoặc kiểm tra</p>
            </button>
            <button type="button" onClick={() => setQuickFilter("DRAFT", today())} className="rounded-md border border-[#e2d6ff] bg-[#f7f2ff] p-4 text-left text-[#673ab7] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Có thể công bố</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.publishable}</p>
              <p className="mt-1 text-xs opacity-75">Ca đã bắt đầu hoặc hoàn tất</p>
            </button>
            <button type="button" onClick={() => setQuickFilter("PUBLISHED", today())} className="rounded-md border border-[#c7ead0] bg-[#f0fff4] p-4 text-left text-[#1f7a3a] transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-sm font-medium opacity-80">Đã công bố</p>
              <p className="mt-2 text-2xl font-semibold">{doctorSummary.published}</p>
              <p className="mt-1 text-xs opacity-75">{doctorSummary.needPrescription} hồ sơ chưa có đơn</p>
            </button>
          </div>
        ) : null}

        <DashboardSurface>
          <form onSubmit={applyRecordSearch} className={`grid gap-3 border-b border-border p-4 ${isDoctor ? "lg:grid-cols-2 2xl:grid-cols-[170px_170px_minmax(0,1fr)_auto]" : "lg:grid-cols-2 2xl:grid-cols-[170px_minmax(0,1fr)_170px_170px_auto]"}`}>
            <VietnamDateInput value={date} onChange={(value) => { setDate(value); setPage(1); }} ariaLabel="Ngày lọc hồ sơ khám" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
            {!isDoctor ? (
              <select value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                <option value="">Tất cả bác sĩ</option>
                {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctorName(doctor)}</option>)}
              </select>
            ) : null}
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
              {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <Input value={recordCode} onChange={(e) => setRecordCode(e.target.value)} placeholder="Mã hồ sơ" />
            <Button type="submit"><Search />Tìm kiếm</Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[#667892]">
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Hồ sơ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Bệnh nhân</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Lịch hẹn</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Bác sĩ</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Kết quả</th>
                  <th className="border-b border-[#e5ebf3] px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Đang tải hồ sơ...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#667892]">Chưa có hồ sơ phù hợp</td></tr>
                ) : records.map((record) => (
                  <tr key={record.id} className="align-top">
                    <td className="border-b border-[#eef2f7] px-4 py-3">
                      <button onClick={() => openDetail(record)} className="font-semibold text-[#0d4f8b] hover:underline">{record.recordCode}</button>
                      <p className="mt-1 text-xs text-[#667892]">{record.labResults.length} kết quả cận lâm sàng</p>
                    </td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p className="font-semibold">{record.patient.fullName}</p><p className="mt-1 text-xs text-[#667892]">{record.patient.phone}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p>{record.appointment.bookingCode}</p><p className="mt-1 text-xs text-[#667892]">{formatDate(record.appointment.appointmentDate)} {record.appointment.startTime}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><p>{doctorName(record.doctor)}</p><p className="mt-1 text-xs text-[#667892]">{record.doctor.department.name}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3"><DashboardStatusBadge tone={statusTone[record.status]}>{statusLabel[record.status]}</DashboardStatusBadge><p className="mt-1 text-xs text-[#667892]">{record.diagnosis || "Chưa có chẩn đoán"}</p></td>
                    <td className="border-b border-[#eef2f7] px-4 py-3 text-right"><button onClick={() => openDetail(record)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Chi tiết</button></td>
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
          title={selected ? `Hồ sơ ${selected.recordCode}` : "Chi tiết hồ sơ khám"}
          description="Cập nhật chẩn đoán, điều trị và kết quả cận lâm sàng trong cùng một vùng làm việc."
        >
        {selected ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-[#55708f]">Chi tiết hồ sơ</p>
              <h3 className="mt-1 text-xl font-semibold">{selected.recordCode}</h3>
              <DashboardStatusBadge tone={statusTone[selected.status]} className="mt-3">{statusLabel[selected.status]}</DashboardStatusBadge>
            </div>

            <div className="rounded-md border border-[#e5ebf3] p-3 text-sm">
              <p className="font-semibold">{selected.patient.fullName}</p>
              <p className="text-[#667892]">{selected.patient.phone || "-"} · {selected.appointment.bookingCode}</p>
              <p className="mt-1 text-[#667892]">{doctorName(selected.doctor)} · {selected.doctor.department.name}</p>
            </div>

            <form className="space-y-3" onSubmit={saveRecord}>
              {[
                ["symptoms", "Triệu chứng"],
                ["diagnosis", "Chẩn đoán"],
                ["treatment", "Hướng điều trị"],
                ["prescription", "Đơn thuốc ghi chú"],
                ["doctorNotes", "Ghi chú bác sĩ"],
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-sm font-medium text-[#334155]">{label}</span>
                  <textarea value={recordForm[key as keyof RecordForm]} onChange={(e) => setRecordForm((current) => ({ ...current, [key]: e.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                </label>
              ))}
              <label className="block">
                <span className="text-sm font-medium text-[#334155]">Đường dẫn tệp kết quả</span>
                <input value={recordForm.resultPdfUrl} onChange={(e) => setRecordForm((current) => ({ ...current, resultPdfUrl: e.target.value }))} placeholder="https://..." className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingRecordFile}
                  onChange={(event) => void uploadRecordResultFile(event.target.files?.[0])}
                  className="mt-2 w-full rounded-md border border-dashed border-[#cfd8e6] bg-[#f8fafc] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#0d4f8b] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:opacity-60"
                />
                <p className="mt-1 text-xs text-[#667892]">
                  Tải lên hỗ trợ ảnh JPG, PNG và WEBP trong thư mục kết quả khám.
                </p>
                {recordForm.resultPdfUrl ? (
                  <div className="mt-2 rounded-md border border-[#e5ebf3] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={recordForm.resultPdfUrl}
                      alt="Xem trước tệp kết quả"
                      className="h-36 w-full rounded-md object-cover"
                    />
                    <p className="mt-2 truncate text-xs text-[#667892]">{recordForm.resultPdfUrl}</p>
                  </div>
                ) : null}
              </label>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy || uploadingRecordFile} className="rounded-md bg-[#0d4f8b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{uploadingRecordFile ? "Đang tải lên..." : "Lưu hồ sơ"}</button>
                {selected.status !== "PUBLISHED" ? <button type="button" disabled={busy} onClick={() => void simpleRecordAction(selected, "/publish", "Đã công bố kết quả")} className="rounded-md border border-[#cfd8e6] px-4 py-2 text-sm font-medium text-[#42526b]">Công bố</button> : null}
                {canCreatePrescription && !selected.prescriptionRecord ? <button type="button" disabled={busy} onClick={() => void createPrescriptionFromRecord(selected)} className="rounded-md border border-[#cfe4fa] px-4 py-2 text-sm font-medium text-[#0d4f8b]">Tạo đơn thuốc</button> : null}
                {selected.prescriptionRecord ? <Link href="/dashboard/prescriptions" className="rounded-md border border-[#cfe4fa] px-4 py-2 text-sm font-medium text-[#0d4f8b]">Mở đơn thuốc</Link> : null}
                {canArchive && selected.status !== "ARCHIVED" ? <button type="button" disabled={busy} onClick={() => void simpleRecordAction(selected, "/archive", "Đã lưu trữ hồ sơ")} className="rounded-md border border-[#cfd8e6] px-4 py-2 text-sm font-medium text-[#42526b]">Lưu trữ</button> : null}
              </div>
            </form>

            <section className="border-t border-[#e5ebf3] pt-5">
              <h4 className="font-semibold">Kết quả cận lâm sàng</h4>
              <div className="mt-3 space-y-2">
                {selected.labResults.length === 0 ? <p className="text-sm text-[#667892]">Chưa có kết quả cận lâm sàng</p> : selected.labResults.map((lab) => (
                  <div key={lab.id} className="rounded-md border border-[#e5ebf3] p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{lab.testName}</p>
                        <p className="text-[#667892]">{lab.resultValue || "-"} {lab.unit || ""}</p>
                        <p className="text-xs text-[#667892]">Mốc: {lab.referenceRange || "-"}</p>
                        <p className="mt-1">{lab.conclusion || ""}</p>
                        {lab.fileUrl ? <a href={lab.fileUrl} target="_blank" className="text-xs font-medium text-[#0d4f8b]">Mở file</a> : null}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setEditingLab(lab); setDeleteLabTarget(null); setLabForm(toLabForm(lab)); }} className="rounded-md border border-[#cfd8e6] px-2 py-1 text-xs text-[#42526b]">Sửa</button>
                        <button type="button" onClick={() => { setDeleteLabTarget(lab); setEditingLab(null); }} className="rounded-md border border-[#f2b8b5] px-2 py-1 text-xs text-[#b3261e]">Xoá</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {deleteLabTarget ? (
                <div className="mt-3 rounded-md border border-[#f2d4d2] bg-[#fff8f7] p-3 text-sm">
                  <p className="font-semibold text-[#8f1d18]">Xoá kết quả cận lâm sàng?</p>
                  <p className="mt-1 text-[#667892]">{deleteLabTarget.testName}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setDeleteLabTarget(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Giữ lại</button>
                    <button type="button" disabled={busy} onClick={() => void deleteLabResult()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xoá kết quả</button>
                  </div>
                </div>
              ) : null}

              <form className="mt-4 space-y-3 rounded-md border border-[#e5ebf3] p-3" onSubmit={saveLabResult}>
                <h5 className="font-semibold">{editingLab ? "Sửa kết quả cận lâm sàng" : "Thêm kết quả cận lâm sàng"}</h5>
                <input value={labForm.testName} onChange={(e) => setLabForm((current) => ({ ...current, testName: e.target.value }))} placeholder="Tên xét nghiệm" className="w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={labForm.resultValue} onChange={(e) => setLabForm((current) => ({ ...current, resultValue: e.target.value }))} placeholder="Giá trị" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  <input value={labForm.unit} onChange={(e) => setLabForm((current) => ({ ...current, unit: e.target.value }))} placeholder="Đơn vị" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                </div>
                <input value={labForm.referenceRange} onChange={(e) => setLabForm((current) => ({ ...current, referenceRange: e.target.value }))} placeholder="Khoảng tham chiếu" className="w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                <textarea value={labForm.conclusion} onChange={(e) => setLabForm((current) => ({ ...current, conclusion: e.target.value }))} placeholder="Kết luận" rows={2} className="w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                <div>
                  <input value={labForm.fileUrl} onChange={(e) => setLabForm((current) => ({ ...current, fileUrl: e.target.value }))} placeholder="Đường dẫn tệp kết quả" className="w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingLabFile}
                    onChange={(event) => void uploadLabResultFile(event.target.files?.[0])}
                    className="mt-2 w-full rounded-md border border-dashed border-[#cfd8e6] bg-[#f8fafc] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#0d4f8b] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:opacity-60"
                  />
                  <p className="mt-1 text-xs text-[#667892]">
                    Tải lên hỗ trợ ảnh JPG, PNG và WEBP trong thư mục kết quả khám.
                  </p>
                  {labForm.fileUrl ? (
                    <div className="mt-2 rounded-md border border-[#e5ebf3] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={labForm.fileUrl}
                        alt="Xem trước tệp cận lâm sàng"
                        className="h-32 w-full rounded-md object-cover"
                      />
                      <p className="mt-2 truncate text-xs text-[#667892]">{labForm.fileUrl}</p>
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button disabled={busy || uploadingLabFile} className="flex-1 rounded-md bg-[#0d4f8b] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{uploadingLabFile ? "Đang tải lên..." : busy ? "Đang lưu..." : editingLab ? "Lưu kết quả" : "Thêm kết quả"}</button>
                  {editingLab ? <button type="button" onClick={() => { setEditingLab(null); setLabForm(emptyLabForm); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Huỷ</button> : null}
                </div>
              </form>
            </section>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-[#55708f]">Chi tiết hồ sơ</p>
            <h3 className="mt-1 text-xl font-semibold">Chọn một hồ sơ</h3>
            <p className="mt-2 text-sm leading-6 text-[#667892]">Bấm vào mã hồ sơ để cập nhật chẩn đoán, điều trị và kết quả cận lâm sàng.</p>
          </div>
        )}
        </DashboardWorkspace>
      </aside>
      ) : null}
    </div>
  );
}
