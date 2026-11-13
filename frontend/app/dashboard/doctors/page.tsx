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
import { useDashboardDoctors, useDashboardDoctorUsers } from "@/lib/dashboard-doctors-query";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { DoctorProfile } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Bác sĩ: danh sách bên trái; chọn một hồ sơ hoặc bấm "Tạo hồ sơ" thì biểu mẫu mở cạnh danh sách, không che nội dung.

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

const emptyForm: DoctorForm = { userId: "", departmentId: "", title: "", specialization: "", experience: "", consultationFee: "0", bio: "", isAvailable: true };

const availabilityTabs = [
  { id: "", label: "Tất cả" },
  { id: "true", label: "Sẵn sàng khám" },
  { id: "false", label: "Tạm ngừng" },
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
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

const formatMoneyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
};

const parseMoneyInput = (value: string) => value.replace(/\D/g, "");

const displayName = (doctor: DoctorProfile) => [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

function Avatar({ doctor }: { doctor: DoctorProfile }) {
  return doctor.user.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={doctor.user.avatar} alt="" loading="lazy" decoding="async" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flex: "none" }} />
  ) : (
    <span
      aria-hidden="true"
      style={{ width: 36, height: 36, borderRadius: 6, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--ds-sunken)", color: "var(--ds-accent)", fontWeight: 600 }}
    >
      {doctor.user.fullName.slice(0, 1).toUpperCase()}
    </span>
  );
}

type PaneState = { kind: "new" } | { kind: "edit"; id: string } | null;

export default function DoctorsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isAvailable, setIsAvailable] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pane, setPane] = useState<PaneState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<DoctorForm>(emptyForm);

  const canWrite = can(user, "catalog.manage");
  const canDelete = can(user, "catalog.delete");

  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const term = useDebouncedValue(search.trim());
  const query = useMemo(() => ({ search: term || undefined, departmentId: departmentId || undefined, isAvailable: isAvailable || undefined, page, limit: 10 }), [departmentId, isAvailable, page, term]);
  const departmentQuery = useMemo(() => ({ isActive: "true", limit: 100 }), []);
  const doctorUsersQuery = useMemo(() => ({ role: "DOCTOR", isActive: "true", limit: 100 }), []);
  const doctorsQuery = useDashboardDoctors(query);
  const departmentsQuery = useDashboardDepartments(departmentQuery);
  const doctorUsersResult = useDashboardDoctorUsers(doctorUsersQuery, can(user, "user.manage"));
  const doctors = doctorsQuery.data?.items ?? [];
  const departments = departmentsQuery.data?.items ?? [];
  const doctorUsers = doctorUsersResult.data?.items ?? [];
  const pagination = doctorsQuery.data?.pagination ?? { page, limit: 10, total: 0, totalPages: 1 };
  const queryError = doctorsQuery.error || departmentsQuery.error || doctorUsersResult.error;
  const queryErrorMessage = queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu bác sĩ") : "";
  const visibleError = error || queryErrorMessage;
  const editing = pane?.kind === "edit" ? doctors.find((item) => item.id === pane.id) ?? null : null;
  const open = pane?.kind === "new" ? canWrite : pane?.kind === "edit" && Boolean(editing);

  const invalidateDoctors = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctors"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "users"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "doctors"] }),
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
    setConfirmDelete(false);
    setError("");
    setPane({ kind: "new" });
  };

  const openDoctor = (doctor: DoctorProfile) => {
    setForm(toForm(doctor));
    setConfirmDelete(false);
    setError("");
    setPane({ kind: "edit", id: doctor.id });
  };

  const closePane = () => {
    setPane(null);
    setConfirmDelete(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (pane?.kind === "edit") {
        await apiRequest<DoctorProfile>(`/dashboard/doctors/${pane.id}`, { method: "PATCH", body: buildUpdatePayload(form) });
        setNotice("Đã cập nhật hồ sơ bác sĩ");
      } else {
        await apiRequest<DoctorProfile>("/dashboard/doctors", { method: "POST", body: buildCreatePayload(form) });
        setNotice("Đã tạo hồ sơ bác sĩ");
        closePane();
      }
      await invalidateDoctors();
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
      await apiRequest<DoctorProfile>(`/dashboard/doctors/${doctor.id}/availability`, { method: "PATCH", body: { isAvailable: !doctor.isAvailable } });
      setNotice(doctor.isAvailable ? "Đã tạm ngừng nhận lịch" : "Đã sẵn sàng nhận lịch");
      if (pane?.kind === "edit" && pane.id === doctor.id) setForm((current) => ({ ...current, isAvailable: !doctor.isAvailable }));
      await invalidateDoctors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái");
    }
  };

  const handleDelete = async () => {
    if (!editing || !canDelete) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiRequest<DoctorProfile>(`/dashboard/doctors/${editing.id}`, { method: "DELETE" });
      setNotice("Đã xóa hồ sơ bác sĩ");
      closePane();
      await invalidateDoctors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được hồ sơ bác sĩ");
    } finally {
      setSaving(false);
    }
  };

  const doctorUserOptions = doctorUsers.filter((doctorUser) =>
    editing ? doctorUser.id === editing.user.id || !doctors.some((doctor) => doctor.user.id === doctorUser.id) : !doctors.some((doctor) => doctor.user.id === doctorUser.id),
  );

  const columns: DsColumn<DoctorProfile>[] = [
    {
      key: "doctor",
      header: "Bác sĩ",
      cell: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar doctor={row} />
          <div>
            <strong>{displayName(row)}</strong>
            <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.user.phone || row.user.email || "Chưa có liên hệ"}</div>
          </div>
        </div>
      ),
    },
    { key: "department", header: "Chuyên khoa", cell: (row) => row.department.name },
    {
      key: "spec",
      header: "Chuyên môn",
      cell: (row) => (
        <div>
          {row.specialization || "-"}
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.experience ?? 0} năm kinh nghiệm</div>
        </div>
      ),
    },
    { key: "fee", header: "Phí khám", align: "num", cell: (row) => formatCurrency(row.consultationFee) },
    { key: "schedule", header: "Lịch", cell: (row) => `${row._count.schedules} lịch / ${row._count.timeSlots} khung giờ` },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={row.isAvailable ? "good" : "neutral"}>{row.isAvailable ? "Sẵn sàng" : "Tạm ngừng"}</DsStatusPill> },
  ];

  const list = (
    <DsPanel flush>
      <form onSubmit={(event) => event.preventDefault()} aria-label="Lọc bác sĩ">
        <DsToolbar>
          <div style={{ minWidth: 180, flex: "1 1 240px" }}>
            <DsInput
              aria-label="Tìm bác sĩ"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Gõ tên, SĐT, học hàm hoặc chuyên môn để lọc"
            />
          </div>
          <div style={{ minWidth: 160, flex: "0 1 220px" }}>
            <DsSelect
              aria-label="Lọc theo chuyên khoa"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả chuyên khoa</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </DsSelect>
          </div>
          {canWrite ? (
            <DsButton variant="primary" onClick={startCreate}>
              <Plus aria-hidden="true" />
              Tạo hồ sơ
            </DsButton>
          ) : null}
        </DsToolbar>
      </form>
      <DsTabs
        label="Lọc bác sĩ theo trạng thái nhận lịch"
        items={availabilityTabs}
        value={isAvailable}
        onChange={(id) => {
          setIsAvailable(id);
          setPage(1);
        }}
      />
      {open ? (
        doctors.length ? (
          <div role="listbox" aria-label="Danh sách bác sĩ">
            {doctors.map((doctor) => (
              <button key={doctor.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "edit" && pane.id === doctor.id} onClick={() => openDoctor(doctor)}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <Avatar doctor={doctor} />
                  <span className="ds-listrow__main">
                    <strong>{displayName(doctor)}</strong>
                    <small>{doctor.department.name}</small>
                  </span>
                </span>
                <DsStatusPill tone={doctor.isAvailable ? "good" : "neutral"}>{doctor.isAvailable ? "Sẵn sàng" : "Tạm ngừng"}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có hồ sơ bác sĩ phù hợp" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách bác sĩ"
          columns={columns}
          rows={doctors}
          rowKey={(row) => row.id}
          loading={doctorsQuery.isLoading}
          emptyTitle="Chưa có hồ sơ bác sĩ phù hợp"
          emptyDescription={canWrite ? "Đổi bộ lọc hoặc bấm Tạo hồ sơ." : undefined}
          onRowClick={openDoctor}
        />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} bác sĩ · trang {pagination.page}/{pagination.totalPages || 1}
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
      title={editing ? displayName(editing) : "Tạo hồ sơ bác sĩ"}
      badge={editing ? <DsStatusPill tone={editing.isAvailable ? "good" : "neutral"}>{editing.isAvailable ? "Sẵn sàng" : "Tạm ngừng"}</DsStatusPill> : undefined}
      onClose={closePane}
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }} aria-label={editing ? "Cập nhật hồ sơ bác sĩ" : "Tạo hồ sơ bác sĩ"}>
        {editing ? (
          <DsKeyValue
            items={[
              { label: "Tài khoản", value: `${editing.user.fullName} (${editing.user.phone || editing.user.email || editing.user.id})` },
              { label: "Lịch làm việc", value: `${editing._count.schedules} lịch mẫu / ${editing._count.timeSlots} khung giờ` },
            ]}
          />
        ) : (
          <>
            <p className="ds-hint" style={{ margin: 0 }}>
              Chọn tài khoản có vai trò Bác sĩ đã tạo ở mục Người dùng, sau đó gắn chuyên khoa và thông tin chuyên môn.
            </p>
            <DsField label="Tài khoản bác sĩ" htmlFor="dr-user" required>
              {can(user, "user.manage") ? (
                <DsSelect id="dr-user" value={form.userId} required onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}>
                  <option value="">Chọn tài khoản bác sĩ</option>
                  {doctorUserOptions.map((doctorUser) => (
                    <option key={doctorUser.id} value={doctorUser.id}>
                      {doctorUser.fullName} - {doctorUser.phone || doctorUser.email || doctorUser.id}
                    </option>
                  ))}
                </DsSelect>
              ) : (
                <DsInput id="dr-user" value={form.userId} required placeholder="Nhập mã tài khoản bác sĩ" onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))} />
              )}
            </DsField>
          </>
        )}
        <DsField label="Chuyên khoa" htmlFor="dr-dept" required>
          <DsSelect id="dr-dept" value={form.departmentId} required disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}>
            <option value="">Chọn chuyên khoa</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </DsSelect>
        </DsField>
        <div className="ds-grid-fields">
          <DsField label="Học hàm / chức danh" htmlFor="dr-title">
            <DsInput id="dr-title" value={form.title} placeholder="BS.CKII" disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </DsField>
          <DsField label="Năm kinh nghiệm" htmlFor="dr-exp">
            <DsInput id="dr-exp" inputMode="numeric" value={form.experience} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, experience: event.target.value.replace(/\D/g, "") }))} />
          </DsField>
        </div>
        <DsField label="Chuyên môn" htmlFor="dr-spec">
          <DsInput id="dr-spec" value={form.specialization} placeholder="Tim mạch, nội tổng quát..." disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, specialization: event.target.value }))} />
        </DsField>
        <DsField label="Phí khám" htmlFor="dr-fee" hint={form.consultationFee ? `Tương đương ${formatCurrency(Number(form.consultationFee))}` : "Ví dụ: 150.000"}>
          <DsInput id="dr-fee" inputMode="numeric" value={formatMoneyInput(form.consultationFee)} placeholder="150.000" disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, consultationFee: parseMoneyInput(event.target.value) }))} />
        </DsField>
        <DsField label="Giới thiệu" htmlFor="dr-bio">
          <DsTextarea id="dr-bio" rows={4} value={form.bio} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} />
        </DsField>
        <label className="ds-check" style={{ cursor: canWrite ? "pointer" : "default" }}>
          <input type="checkbox" checked={form.isAvailable} disabled={!canWrite} onChange={(event) => setForm((current) => ({ ...current, isAvailable: event.target.checked }))} style={{ marginTop: 3 }} />
          <span>
            <strong>Sẵn sàng nhận lịch</strong>
            <small style={{ display: "block", color: "var(--ds-muted)" }}>Bác sĩ tạm ngừng không nhận lịch hẹn mới.</small>
          </span>
        </label>
        {canWrite ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {editing ? (
              <DsButton onClick={() => void handleAvailability(editing)}>{editing.isAvailable ? "Tạm ngừng nhận lịch" : "Mở lại nhận lịch"}</DsButton>
            ) : null}
            <DsButton onClick={closePane}>Đóng</DsButton>
            <DsButton type="submit" variant="primary" disabled={saving || !form.departmentId || (!editing && !form.userId)}>
              {saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo hồ sơ"}
            </DsButton>
          </div>
        ) : null}
        {editing && canDelete ? (
          confirmDelete ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}>Xóa hồ sơ bác sĩ {editing.user.fullName}?</span>
              <DsButton variant="danger" disabled={saving} onClick={() => void handleDelete()}>
                Xóa
              </DsButton>
              <DsButton onClick={() => setConfirmDelete(false)}>Giữ lại</DsButton>
            </div>
          ) : (
            <div>
              <DsButton variant="ghost" onClick={() => setConfirmDelete(true)}>
                Xóa hồ sơ
              </DsButton>
            </div>
          )
        ) : null}
      </form>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader title="Bác sĩ" description="Hồ sơ chuyên môn, chuyên khoa, phí khám và trạng thái nhận lịch" />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {visibleError ? <DsNotice tone="bad">{visibleError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsSplit list={list} pane={paneNode} />
    </>
  );
}
