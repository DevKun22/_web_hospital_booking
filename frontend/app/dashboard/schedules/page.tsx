"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  DsEditDialog,
  DsPanel,
  DsSelect,
  DsStatusPill,
  DsTabs,
  DsToolbar,
  type DsColumn,
  useActionToast,
} from "@/components/ds";
import { ScheduleRequestForm, requestTypeLabels, scheduleDays } from "@/components/schedules/schedule-request-form";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardDoctorSchedules, useDashboardDoctorTimeSlots, useDashboardScheduleDoctors } from "@/lib/dashboard-schedules-query";
import { formatVietnamDate } from "@/lib/date";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type {
  Facility,
  DoctorSchedule,
  DoctorTimeSlot,
  ListResult,
  ScheduleChangeRequest,
} from "@/lib/types";
import { GenerateSlotsDialog } from "./generate-slots-dialog";
import { ReconcileDialog } from "./reconcile-dialog";
import { RequestDialog } from "./request-dialog";
import { SlotDialog } from "./slot-dialog";
import { TimeOffDialog } from "./time-off-dialog";
import {
  type ScheduleForm,
  type PaneState,
  emptyScheduleForm,
  slotStatusOptions,
  effectiveSlotStatus,
  requestStatusLabel,
  requestStatusTone,
  today,
  type ScheduleImpact,
  impactText,
  doctorName,
  toScheduleForm,
  buildUpdateSchedulePayload,
  buildCreateSchedulePayload,
  viewTabs,
} from "./schedule-model";

// Lịch bác sĩ: ba góc nhìn (khung giờ theo ngày, lịch mẫu theo tuần, yêu cầu đổi lịch) dùng chung một khung làm việc bên phải;
// chọn một dòng hoặc bấm công cụ thì khung mở cạnh danh sách, không che nội dung.

const dayOptions = scheduleDays.map((label, index) => ({ value: String(index), label }));
const dayLabel = (day: number) => scheduleDays[day] ?? "";

export default function SchedulesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"slots" | "schedules" | "requests">("slots");
  const [pane, setPane] = useState<PaneState>(null);
  const [doctorId, setDoctorId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [scheduleActive, setScheduleActive] = useState("");
  const [slotDoctorId, setSlotDoctorId] = useState("");
  const [slotDate, setSlotDate] = useState(today());
  const [slotStatus, setSlotStatus] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [schedulePage, setSchedulePage] = useState(1);
  const [slotPage, setSlotPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canWrite = can(user, "schedule.manage");
  const canReconcile = can(user, "schedule.reconcile");
  const isDoctor = user?.role === "DOCTOR";
  const canManageSlots = canWrite || isDoctor;
  const canLockRange = can(user, "schedule.lock");
  const showRequests = canWrite || Boolean(isDoctor);

  const scheduleQuery = useMemo(
    () => ({ doctorId: isDoctor ? undefined : doctorId || undefined, dayOfWeek: dayOfWeek || undefined, isActive: scheduleActive || undefined, page: schedulePage, limit: 20 }),
    [dayOfWeek, doctorId, isDoctor, scheduleActive, schedulePage],
  );
  const slotQuery = useMemo(
    () => ({ doctorId: isDoctor ? undefined : slotDoctorId || undefined, date: slotDate || undefined, status: slotStatus || undefined, page: slotPage, limit: 30 }),
    [isDoctor, slotDate, slotDoctorId, slotPage, slotStatus],
  );
  // Người quản lý mặc định thấy yêu cầu chờ duyệt; bác sĩ thấy mọi yêu cầu của mình.
  const requestFilters = useMemo(() => ({ status: isDoctor ? requestStatus || undefined : requestStatus || "PENDING", limit: 20 }), [isDoctor, requestStatus]);
  const doctorQuery = useMemo(() => ({ isAvailable: "true", limit: 100 }), []);
  const doctorsQuery = useDashboardScheduleDoctors(doctorQuery, !isDoctor && can(user, "catalog.view"));
  const schedulesQuery = useDashboardDoctorSchedules(scheduleQuery);
  const slotsQuery = useDashboardDoctorTimeSlots(slotQuery);
  // Danh sách cơ sở đang hoạt động; chỉ hiện ô chọn cơ sở khi có từ hai cơ sở trở lên.
  const facilitiesQuery = useQuery({ queryKey: ["dashboard", "facilities"], queryFn: () => apiRequest<Facility[]>("/dashboard/facilities"), staleTime: 60_000 });
  const facilities = (facilitiesQuery.data ?? []).filter((item) => item.isActive !== false);
  const requestsQuery = useQuery({
    queryKey: queryKeys.dashboardScheduleChangeRequests(requestFilters),
    queryFn: () => apiRequest<ListResult<ScheduleChangeRequest>>("/dashboard/schedule-change-requests", { query: requestFilters }),
    enabled: showRequests,
  });
  const pendingQuery = useQuery({
    queryKey: queryKeys.dashboardScheduleChangeRequests({ status: "PENDING", limit: 1 }),
    queryFn: () => apiRequest<ListResult<ScheduleChangeRequest>>("/dashboard/schedule-change-requests", { query: { status: "PENDING", limit: 1 } }),
    enabled: showRequests,
  });

  const doctors = doctorsQuery.data?.items ?? [];
  const schedules = schedulesQuery.data?.items ?? [];
  const slots = slotsQuery.data?.items ?? [];
  const requests = requestsQuery.data?.items ?? [];
  const pendingCount = pendingQuery.data?.pagination.total ?? 0;
  const schedulePagination = schedulesQuery.data?.pagination ?? { page: schedulePage, limit: 20, total: 0, totalPages: 1 };
  const slotPagination = slotsQuery.data?.pagination ?? { page: slotPage, limit: 30, total: 0, totalPages: 1 };
  const queryError = doctorsQuery.error || schedulesQuery.error || slotsQuery.error || requestsQuery.error;
  const queryErrorMessage = queryError ? (queryError instanceof Error ? queryError.message : "Không tải được dữ liệu lịch khám") : "";

  const selectedSlot = pane?.kind === "slot" ? slots.find((item) => item.id === pane.id) ?? null : null;
  const selectedSchedule = pane?.kind === "schedule" ? schedules.find((item) => item.id === pane.id) ?? null : null;
  const selectedRequest = pane?.kind === "request" ? requests.find((item) => item.id === pane.id) ?? null : null;

  const invalidateSchedules = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor-schedules"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "schedule-change-requests"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicBootstrap() }),
    ]);
  };

  const invalidateSlots = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor-time-slots"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "available-slots"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicBootstrap() }),
    ]);
  };

  // Kết quả thao tác hiện thành thông báo nổi ở góc trên phải; lỗi tải dữ liệu vẫn hiện trong trang vì cần giữ lại.
  useActionToast({ notice, error, clear: () => { setNotice(""); setError(""); } });

  const resetEditors = () => {
    setConfirmDelete(false);
  };

  const openPane = (next: PaneState) => {
    resetEditors();
    setError("");
    setPane(next);
  };

  const closePane = () => {
    resetEditors();
    setPane(null);
  };

  const changeView = (next: string) => {
    setView(next as typeof view);
    closePane();
  };

  const openSlot = (slot: DoctorTimeSlot) => openPane({ kind: "slot", id: slot.id });

  const openSchedule = (schedule: DoctorSchedule) => {
    setScheduleForm(toScheduleForm(schedule));
    openPane({ kind: "schedule", id: schedule.id });
  };

  const startNewSchedule = () => {
    setView("schedules");
    setScheduleForm(emptyScheduleForm);
    openPane({ kind: "newSchedule" });
  };

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (pane?.kind === "schedule") {
        const updated = await apiRequest<DoctorSchedule & { impact?: ScheduleImpact }>(`/dashboard/doctor-schedules/${pane.id}`, { method: "PATCH", body: buildUpdateSchedulePayload(scheduleForm) });
        setNotice(`Đã cập nhật lịch làm việc.${impactText(updated.impact)}`);
        await invalidateSlots();
      } else {
        const created = await apiRequest<DoctorSchedule & { impact?: ScheduleImpact }>("/dashboard/doctor-schedules", { method: "POST", body: buildCreateSchedulePayload(scheduleForm) });
        setNotice(`Đã tạo lịch làm việc.${impactText(created.impact)}`);
        await invalidateSlots();
        closePane();
      }
      await invalidateSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được lịch làm việc");
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async () => {
    if (!canWrite || pane?.kind !== "schedule") return;
    setError("");
    setNotice("");
    try {
      const removed = await apiRequest<DoctorSchedule & { impact?: ScheduleImpact }>(`/dashboard/doctor-schedules/${pane.id}`, { method: "DELETE" });
      setNotice(`Đã xoá lịch làm việc.${impactText(removed.impact)}`);
      await invalidateSlots();
      closePane();
      await invalidateSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được lịch làm việc");
    }
  };

  const ownDoctorId = schedules[0]?.doctor?.id ?? "";

  const slotColumns: DsColumn<DoctorTimeSlot>[] = [
    {
      key: "time",
      header: "Thời gian",
      cell: (row) => (
        <div>
          <strong>{formatVietnamDate(row.date)}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>
            {row.startTime} - {row.endTime}
          </div>
        </div>
      ),
    },
    ...(!isDoctor
      ? [
          {
            key: "doctor",
            header: "Bác sĩ",
            cell: (row: DoctorTimeSlot) => (
              <div>
                {doctorName(row.doctor)}
                <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.doctor.department.name}</div>
              </div>
            ),
          } satisfies DsColumn<DoctorTimeSlot>,
        ]
      : []),
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => {
        const status = effectiveSlotStatus(row);
        return (
          <div>
            <DsStatusPill tone={status.tone}>{status.label}</DsStatusPill>
            {row.lockReason ? <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.lockReason}</div> : null}
          </div>
        );
      },
    },
    { key: "appointment", header: "Lịch hẹn", cell: (row) => (row.appointment?.bookingCode ? <span className="ds-mono">{row.appointment.bookingCode}</span> : "-") },
  ];

  const scheduleColumns: DsColumn<DoctorSchedule>[] = [
    {
      key: "doctor",
      header: "Bác sĩ",
      cell: (row) => (
        <div>
          <strong>{doctorName(row.doctor)}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.doctor.department.name}</div>
        </div>
      ),
    },
    { key: "day", header: "Thứ", cell: (row) => dayLabel(row.dayOfWeek) },
    { key: "hours", header: "Giờ", cell: (row) => `${row.startTime} - ${row.endTime}` },
    { key: "slot", header: "Khung giờ", cell: (row) => `${row.slotDuration} phút / khung giờ` },
    { key: "active", header: "Trạng thái", cell: (row) => <DsStatusPill tone={row.isActive ? "good" : "neutral"}>{row.isActive ? "Đang dùng" : "Tạm tắt"}</DsStatusPill> },
  ];

  const requestColumns: DsColumn<ScheduleChangeRequest>[] = [
    {
      key: "who",
      header: isDoctor ? "Yêu cầu" : "Bác sĩ",
      cell: (row) => (
        <div>
          <strong>{isDoctor ? requestTypeLabels[row.type] : doctorName(row.doctor)}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{isDoctor ? "" : requestTypeLabels[row.type]}</div>
        </div>
      ),
    },
    {
      key: "proposal",
      header: "Đề xuất",
      cell: (row) => (
        <div>
          {dayLabel(row.dayOfWeek)} · {row.startTime} - {row.endTime}
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>từ {formatVietnamDate(row.effectiveFrom)}</div>
        </div>
      ),
    },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={requestStatusTone[row.status]}>{requestStatusLabel[row.status]}</DsStatusPill> },
  ];

  // Khung bên phải chỉ mở khi có nội dung hiển thị được (đúng quyền, mục chọn còn trong danh sách).
  const open =
    pane !== null &&
    (pane.kind === "slot"
      ? Boolean(selectedSlot)
      : pane.kind === "schedule"
        ? Boolean(selectedSchedule)
        : pane.kind === "request"
          ? Boolean(selectedRequest)
          : pane.kind === "timeOff"
            ? canLockRange
          : pane.kind === "newSchedule" || pane.kind === "generate"
            ? canWrite
            : pane.kind === "reconcile"
              ? canReconcile
              : Boolean(isDoctor));

  const doctorSelect = (value: string, onChange: (next: string) => void, label: string) => (
    <div style={{ minWidth: 160, flex: "1 1 180px" }}>
      <DsSelect aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Tất cả bác sĩ</option>
        {doctors.map((doctor) => (
          <option key={doctor.id} value={doctor.id}>
            {doctorName(doctor)}
          </option>
        ))}
      </DsSelect>
    </div>
  );

  const pager = (current: number, total: number, count: number, set: (updater: (page: number) => number) => void, unit: string) => (
    <div className="ds-pager">
      <span>
        {count} {unit} · trang {current}/{total || 1}
      </span>
      <span style={{ display: "flex", gap: 8 }}>
        <DsButton disabled={current <= 1} onClick={() => set((page) => Math.max(page - 1, 1))}>
          Trước
        </DsButton>
        <DsButton disabled={current >= total} onClick={() => set((page) => page + 1)}>
          Sau
        </DsButton>
      </span>
    </div>
  );

  const slotsView = (
    <>
      <DsToolbar>
        {!isDoctor ? doctorSelect(slotDoctorId, (next) => { setSlotDoctorId(next); setSlotPage(1); }, "Lọc khung giờ theo bác sĩ") : null}
        <div style={{ minWidth: 150, flex: "0 1 170px" }}>
          <VietnamDateInput value={slotDate} onChange={(value) => { setSlotDate(value); setSlotPage(1); }} ariaLabel="Ngày lọc khung giờ" className="ds-input" />
        </div>
        <DsButton variant="ghost" onClick={() => { setSlotDate(today()); setSlotPage(1); }}>
          Hôm nay
        </DsButton>
        {slotDate ? (
          <DsButton variant="ghost" onClick={() => { setSlotDate(""); setSlotPage(1); }}>
            Mọi ngày
          </DsButton>
        ) : null}
        <div style={{ minWidth: 140, flex: "0 1 170px" }}>
          <DsSelect aria-label="Lọc khung giờ theo trạng thái" value={slotStatus} onChange={(event) => { setSlotStatus(event.target.value); setSlotPage(1); }}>
            {slotStatusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </DsSelect>
        </div>
      </DsToolbar>
      {open ? (
        slots.length ? (
          <div role="listbox" aria-label="Danh sách khung giờ">
            {slots.map((slot) => {
              const status = effectiveSlotStatus(slot);
              return (
                <button key={slot.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "slot" && pane.id === slot.id} onClick={() => openSlot(slot)}>
                  <span className="ds-listrow__main">
                    <strong>
                      {formatVietnamDate(slot.date)} · {slot.startTime} - {slot.endTime}
                    </strong>
                    <small>{isDoctor ? slot.appointment?.bookingCode || "Chưa có lịch hẹn" : doctorName(slot.doctor)}</small>
                  </span>
                  <DsStatusPill tone={status.tone}>{status.label}</DsStatusPill>
                </button>
              );
            })}
          </div>
        ) : (
          <DsEmptyState title="Chưa có khung giờ phù hợp" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách khung giờ khám"
          columns={slotColumns}
          rows={slots}
          rowKey={(row) => row.id}
          loading={slotsQuery.isLoading}
          emptyTitle="Chưa có khung giờ phù hợp"
          emptyDescription={canWrite ? "Đổi bộ lọc hoặc bấm Tạo khung giờ để sinh khung giờ từ lịch mẫu." : "Đổi ngày hoặc bộ lọc để xem khung giờ khác."}
          onRowClick={openSlot}
        />
      )}
      {pager(slotPagination.page, slotPagination.totalPages, slotPagination.total, setSlotPage, "khung giờ")}
    </>
  );

  const schedulesView = (
    <>
      <DsToolbar>
        {!isDoctor ? doctorSelect(doctorId, (next) => { setDoctorId(next); setSchedulePage(1); }, "Lọc lịch mẫu theo bác sĩ") : null}
        <div style={{ minWidth: 130, flex: "0 1 160px" }}>
          <DsSelect aria-label="Lọc theo thứ" value={dayOfWeek} onChange={(event) => { setDayOfWeek(event.target.value); setSchedulePage(1); }}>
            <option value="">Mọi thứ</option>
            {dayOptions.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </DsSelect>
        </div>
        <div style={{ minWidth: 130, flex: "0 1 160px" }}>
          <DsSelect aria-label="Lọc theo trạng thái lịch mẫu" value={scheduleActive} onChange={(event) => { setScheduleActive(event.target.value); setSchedulePage(1); }}>
            <option value="">Mọi trạng thái</option>
            <option value="true">Đang dùng</option>
            <option value="false">Tạm tắt</option>
          </DsSelect>
        </div>
      </DsToolbar>
      {open ? (
        schedules.length ? (
          <div role="listbox" aria-label="Danh sách lịch mẫu">
            {schedules.map((schedule) => (
              <button key={schedule.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "schedule" && pane.id === schedule.id} onClick={() => openSchedule(schedule)}>
                <span className="ds-listrow__main">
                  <strong>
                    {dayLabel(schedule.dayOfWeek)} · {schedule.startTime} - {schedule.endTime}
                  </strong>
                  <small>{isDoctor ? `${schedule.slotDuration} phút / khung` : doctorName(schedule.doctor)}</small>
                </span>
                <DsStatusPill tone={schedule.isActive ? "good" : "neutral"}>{schedule.isActive ? "Đang dùng" : "Tạm tắt"}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có lịch mẫu" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách lịch mẫu theo tuần"
          columns={scheduleColumns}
          rows={schedules}
          rowKey={(row) => row.id}
          loading={schedulesQuery.isLoading}
          emptyTitle="Chưa có lịch mẫu"
          emptyDescription={canWrite ? "Bấm Tạo lịch mẫu để thêm lịch làm việc theo tuần cho bác sĩ." : undefined}
          onRowClick={openSchedule}
        />
      )}
      {pager(schedulePagination.page, schedulePagination.totalPages, schedulePagination.total, setSchedulePage, "lịch mẫu")}
    </>
  );

  const requestsView = (
    <>
      <DsToolbar>
        <div style={{ minWidth: 150, flex: "0 1 200px" }}>
          <DsSelect aria-label="Lọc yêu cầu theo trạng thái" value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)}>
            {isDoctor ? <option value="">Mọi trạng thái</option> : null}
            <option value={isDoctor ? "PENDING" : ""}>Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Từ chối</option>
            <option value="CANCELLED">Đã hủy</option>
          </DsSelect>
        </div>
        {isDoctor ? (
          <DsButton variant="primary" onClick={() => openPane({ kind: "newRequest" })}>
            <Plus aria-hidden="true" />
            Gửi yêu cầu mới
          </DsButton>
        ) : null}
      </DsToolbar>
      {open ? (
        requests.length ? (
          <div role="listbox" aria-label="Danh sách yêu cầu đổi lịch">
            {requests.map((request) => (
              <button key={request.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "request" && pane.id === request.id} onClick={() => openPane({ kind: "request", id: request.id })}>
                <span className="ds-listrow__main">
                  <strong>{isDoctor ? requestTypeLabels[request.type] : doctorName(request.doctor)}</strong>
                  <small>
                    {dayLabel(request.dayOfWeek)} · {request.startTime} - {request.endTime}
                  </small>
                </span>
                <DsStatusPill tone={requestStatusTone[request.status]}>{requestStatusLabel[request.status]}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có yêu cầu" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách yêu cầu đổi lịch"
          columns={requestColumns}
          rows={requests}
          rowKey={(row) => row.id}
          loading={requestsQuery.isLoading}
          emptyTitle={isDoctor ? "Bạn chưa có yêu cầu đổi lịch nào" : "Không có yêu cầu nào đang chờ duyệt"}
          emptyDescription={isDoctor ? "Bấm Gửi yêu cầu mới để đề nghị đổi lịch mẫu." : undefined}
          onRowClick={(row) => openPane({ kind: "request", id: row.id })}
        />
      )}
    </>
  );

  const list = (
    <DsPanel flush>
      <DsTabs label="Chế độ xem lịch bác sĩ" items={viewTabs(showRequests, pendingCount)} value={view} onChange={changeView} />
      {view === "slots" ? slotsView : view === "schedules" ? schedulesView : requestsView}
    </DsPanel>
  );

  const scheduleFormFields = (editing: boolean) => (
    <form onSubmit={saveSchedule} style={{ display: "grid", gap: 12 }} aria-label={editing ? "Cập nhật lịch mẫu" : "Tạo lịch mẫu"}>
      <DsField label="Bác sĩ" htmlFor="sf-doctor" required={!editing}>
        {editing && selectedSchedule ? (
          <DsInput id="sf-doctor" value={doctorName(selectedSchedule.doctor)} disabled readOnly />
        ) : (
          <DsSelect id="sf-doctor" value={scheduleForm.doctorId} required onChange={(event) => setScheduleForm((current) => ({ ...current, doctorId: event.target.value }))}>
            <option value="">Chọn bác sĩ</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctorName(doctor)}
              </option>
            ))}
          </DsSelect>
        )}
      </DsField>
      <div className="ds-grid-fields">
        <DsField label="Thứ trong tuần" htmlFor="sf-day">
          <DsSelect id="sf-day" value={scheduleForm.dayOfWeek} onChange={(event) => setScheduleForm((current) => ({ ...current, dayOfWeek: event.target.value }))}>
            {dayOptions.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </DsSelect>
        </DsField>
        <DsField label="Bắt đầu" htmlFor="sf-start">
          <DsInput id="sf-start" type="time" value={scheduleForm.startTime} required onChange={(event) => setScheduleForm((current) => ({ ...current, startTime: event.target.value }))} />
        </DsField>
        <DsField label="Kết thúc" htmlFor="sf-end">
          <DsInput id="sf-end" type="time" value={scheduleForm.endTime} required onChange={(event) => setScheduleForm((current) => ({ ...current, endTime: event.target.value }))} />
        </DsField>
        {facilities.length > 1 ? (
          <DsField label="Cơ sở khám" htmlFor="sf-facility" hint="Nơi bác sĩ làm theo ca này. Khung giờ trống sắp tới đi theo cơ sở.">
            <DsSelect id="sf-facility" value={scheduleForm.facilityId} onChange={(event) => setScheduleForm((current) => ({ ...current, facilityId: event.target.value }))}>
              <option value="">Cơ sở mặc định</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>{facility.name}</option>
              ))}
            </DsSelect>
          </DsField>
        ) : null}
        <DsField label="Thời lượng khung giờ (phút)" htmlFor="sf-duration">
          <DsInput id="sf-duration" inputMode="numeric" value={scheduleForm.slotDuration} required onChange={(event) => setScheduleForm((current) => ({ ...current, slotDuration: event.target.value.replace(/\D/g, "") }))} />
        </DsField>
      </div>
      <label className="ds-check" style={{ cursor: "pointer" }}>
        <input type="checkbox" checked={scheduleForm.isActive} onChange={(event) => setScheduleForm((current) => ({ ...current, isActive: event.target.checked }))} style={{ marginTop: 3 }} />
        <span>
          <strong>Đang dùng</strong>
          <small style={{ display: "block", color: "var(--ds-muted)" }}>Lịch mẫu tạm tắt không sinh khung giờ mới.</small>
        </span>
      </label>
      <div className="ds-form-actions">
        <DsButton onClick={closePane}>Đóng</DsButton>
        <DsButton type="submit" variant="primary" disabled={saving || (!editing && !scheduleForm.doctorId)}>
          {saving ? "Đang lưu..." : editing ? "Lưu lịch" : "Tạo lịch"}
        </DsButton>
      </div>
    </form>
  );

  let paneNode: React.ReactNode = null;

  if (pane?.kind === "slot" && selectedSlot) {
    paneNode = (
      <SlotDialog
        slot={selectedSlot}
        canWrite={canWrite}
        canManageSlots={canManageSlots}
        onClose={closePane}
        onNotice={setNotice}
        onError={setError}
        invalidateSlots={invalidateSlots}
      />
    );
  } else if (pane?.kind === "schedule" && selectedSchedule) {
    paneNode = (
      <DsEditDialog size="lg"
        title={`${dayLabel(selectedSchedule.dayOfWeek)} · ${selectedSchedule.startTime} - ${selectedSchedule.endTime}`}
        badge={<DsStatusPill tone={selectedSchedule.isActive ? "good" : "neutral"}>{selectedSchedule.isActive ? "Đang dùng" : "Tạm tắt"}</DsStatusPill>}
        onClose={closePane}
      >
        {canWrite ? (
          <div style={{ display: "grid", gap: 12 }}>
            {scheduleFormFields(true)}
            {confirmDelete ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13 }}>
                  Xoá lịch {doctorName(selectedSchedule.doctor)} · {dayLabel(selectedSchedule.dayOfWeek)}?
                </span>
                <DsButton variant="danger" onClick={() => void deleteSchedule()}>
                  Xoá lịch
                </DsButton>
                <DsButton onClick={() => setConfirmDelete(false)}>Giữ lại</DsButton>
              </div>
            ) : (
              <div>
                <DsButton variant="ghost" onClick={() => setConfirmDelete(true)}>
                  Xoá lịch mẫu
                </DsButton>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <DsKeyValue
              items={[
                { label: "Bác sĩ", value: doctorName(selectedSchedule.doctor) },
                { label: "Thứ", value: dayLabel(selectedSchedule.dayOfWeek) },
                { label: "Giờ", value: `${selectedSchedule.startTime} - ${selectedSchedule.endTime}` },
                { label: "Khung giờ", value: `${selectedSchedule.slotDuration} phút / khung giờ` },
              ]}
            />
            {isDoctor ? (
              <div>
                <DsButton variant="primary" onClick={() => openPane({ kind: "newRequest", scheduleId: selectedSchedule.id })}>
                  Gửi yêu cầu đổi lịch này
                </DsButton>
              </div>
            ) : null}
          </div>
        )}
      </DsEditDialog>
    );
  } else if (pane?.kind === "newSchedule" && canWrite) {
    paneNode = (
      <DsEditDialog size="lg" title="Tạo lịch mẫu" onClose={closePane}>
        {scheduleFormFields(false)}
      </DsEditDialog>
    );
  } else if (pane?.kind === "generate" && canWrite) {
    paneNode = (
      <GenerateSlotsDialog
        doctors={doctors}
        onClose={closePane}
        onGenerated={({ doctorId, from }) => {
          setView("slots");
          setSlotDoctorId(doctorId);
          setSlotDate(from);
          setSlotPage(1);
        }}
        onNotice={setNotice}
        onError={setError}
        invalidateSlots={invalidateSlots}
      />
    );
  } else if (pane?.kind === "timeOff" && canLockRange) {
    paneNode = (
      <TimeOffDialog
        doctors={doctors}
        isDoctor={isDoctor}
        ownDoctorId={ownDoctorId}
        onClose={closePane}
        onNotice={setNotice}
        onError={setError}
        invalidateSlots={invalidateSlots}
      />
    );
  } else if (pane?.kind === "reconcile" && canReconcile) {
    paneNode = <ReconcileDialog onClose={closePane} onNotice={setNotice}
        onError={setError}
        invalidateSlots={invalidateSlots} />;
  } else if (pane?.kind === "newRequest" && isDoctor) {
    paneNode = (
      <DsEditDialog size="lg" title="Gửi yêu cầu đổi lịch" onClose={closePane}>
        <ScheduleRequestForm
          schedules={schedules}
          initialScheduleId={pane.scheduleId}
          onSent={() => {
            setNotice("Đã gửi yêu cầu đổi lịch. Bộ phận vận hành sẽ xem và duyệt.");
            setView("requests");
            closePane();
          }}
          onError={setError}
          onCancel={closePane}
        />
      </DsEditDialog>
    );
  } else if (pane?.kind === "request" && selectedRequest) {
    paneNode = (
      <RequestDialog
        request={selectedRequest}
        isDoctor={isDoctor}
        canWrite={canWrite}
        onClose={closePane}
        onNotice={setNotice}
        onError={setError}
        invalidateSlots={invalidateSlots}
        invalidateSchedules={invalidateSchedules}
      />
    );
  }

  return (
    <>
      <DsPageHeader
        title="Lịch bác sĩ"
        description={
          isDoctor
            ? "Theo dõi lịch mẫu, khung giờ của mình và gửi yêu cầu thay đổi để bộ phận vận hành phê duyệt"
            : "Quản lý lịch mẫu theo tuần, tạo khung giờ khám theo ngày và kiểm soát trạng thái từng khung giờ"
        }
        actions={
          <>
            {canWrite ? (
              <DsButton variant="primary" onClick={startNewSchedule}>
                <Plus aria-hidden="true" />
                Tạo lịch mẫu
              </DsButton>
            ) : null}
            {canWrite ? <DsButton onClick={() => openPane({ kind: "generate" })}>Sinh khung giờ</DsButton> : null}
            {canLockRange ? <DsButton onClick={() => openPane({ kind: "timeOff" })}>Nghỉ / đóng lịch</DsButton> : null}
            {canReconcile ? <DsButton onClick={() => openPane({ kind: "reconcile" })}>Đối soát</DsButton> : null}
            {isDoctor ? (
              <DsButton
                variant="primary"
                onClick={() => {
                  setView("requests");
                  openPane({ kind: "newRequest" });
                }}
              >
                Gửi yêu cầu đổi lịch
              </DsButton>
            ) : null}
          </>
        }
      />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {queryErrorMessage ? <DsNotice tone="bad">{queryErrorMessage}</DsNotice> : null}
        {view !== "requests" && !pane ? (
          <DsNotice tone="info">Khung giờ 14 ngày tới được hệ thống tự sinh từ lịch mẫu theo tuần. Đổi hoặc tắt lịch mẫu sẽ gỡ các khung giờ còn trống; lịch đã đặt được giữ và báo cho nhân viên xử lý.</DsNotice>
        ) : null}
      </div>
      {list}
      {paneNode}
    </>
  );
}
