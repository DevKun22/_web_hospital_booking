"use client";

import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { DsButton, DsField, DsInput, DsSelect, DsTextarea } from "@/components/ds";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { apiRequest } from "@/lib/api";
import { getVietnamDateInput } from "@/lib/date";
import type { DoctorSchedule, ScheduleChangeRequest, ScheduleChangeRequestType } from "@/lib/types";

export const scheduleDays = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export const requestTypeLabels: Record<ScheduleChangeRequestType, string> = {
  CREATE_WEEKLY_SCHEDULE: "Tạo lịch mẫu mới",
  UPDATE_WEEKLY_SCHEDULE: "Điều chỉnh lịch mẫu",
  DEACTIVATE_WEEKLY_SCHEDULE: "Tạm ngừng lịch mẫu",
};

type Proposal = { dayOfWeek: number; startTime: string; endTime: string; slotDuration: number; maxPatients: number };

const initialProposal: Proposal = { dayOfWeek: 1, startTime: "08:00", endTime: "11:30", slotDuration: 30, maxPatients: 1 };

const proposalFrom = (schedule: DoctorSchedule | undefined): Proposal =>
  schedule
    ? {
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        slotDuration: schedule.slotDuration,
        maxPatients: schedule.maxPatients,
      }
    : initialProposal;

// Biểu mẫu bác sĩ gửi yêu cầu đổi lịch mẫu: lịch mẫu chỉ thay đổi sau khi được duyệt, khung giờ đã đặt luôn được giữ nguyên.
export function ScheduleRequestForm({
  schedules,
  initialScheduleId,
  onSent,
  onError,
  onCancel,
}: {
  schedules: DoctorSchedule[];
  initialScheduleId?: string;
  onSent: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const startSchedule = schedules.find((item) => item.id === initialScheduleId) ?? schedules[0];
  const [type, setType] = useState<ScheduleChangeRequestType>("UPDATE_WEEKLY_SCHEDULE");
  const [scheduleId, setScheduleId] = useState(startSchedule?.id ?? "");
  const [proposal, setProposal] = useState<Proposal>(proposalFrom(startSchedule));
  const [effectiveFrom, setEffectiveFrom] = useState(getVietnamDateInput());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsSchedule = type !== "CREATE_WEEKLY_SCHEDULE";
  const selectedSchedule = schedules.find((item) => item.id === scheduleId) ?? null;
  const update = <K extends keyof Proposal>(key: K, value: Proposal[K]) => setProposal((current) => ({ ...current, [key]: value }));

  const changeSchedule = (id: string) => {
    setScheduleId(id);
    setProposal(proposalFrom(schedules.find((item) => item.id === id)));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (needsSchedule && !selectedSchedule) return onError("Hãy chọn lịch mẫu cần thay đổi");
    setSubmitting(true);
    try {
      await apiRequest<ScheduleChangeRequest>("/dashboard/schedule-change-requests", {
        method: "POST",
        body: {
          type,
          scheduleId: needsSchedule ? selectedSchedule?.id : null,
          ...proposal,
          isActive: type !== "DEACTIVATE_WEEKLY_SCHEDULE",
          effectiveFrom,
          reason,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", "schedule-change-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "doctor-schedules"] }),
      ]);
      onSent();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Không gửi được yêu cầu đổi lịch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }} aria-label="Gửi yêu cầu đổi lịch">
      <p className="ds-hint" style={{ margin: 0 }}>
        Lịch mẫu chỉ thay đổi sau khi được duyệt. Khung giờ đã đặt luôn được giữ nguyên.
      </p>
      <DsField label="Loại yêu cầu" htmlFor="req-type">
        <DsSelect id="req-type" value={type} onChange={(event) => setType(event.target.value as ScheduleChangeRequestType)}>
          <option value="UPDATE_WEEKLY_SCHEDULE">{requestTypeLabels.UPDATE_WEEKLY_SCHEDULE}</option>
          <option value="DEACTIVATE_WEEKLY_SCHEDULE">{requestTypeLabels.DEACTIVATE_WEEKLY_SCHEDULE}</option>
          <option value="CREATE_WEEKLY_SCHEDULE">{requestTypeLabels.CREATE_WEEKLY_SCHEDULE}</option>
        </DsSelect>
      </DsField>
      {needsSchedule ? (
        <DsField label="Lịch mẫu" htmlFor="req-schedule">
          <DsSelect id="req-schedule" value={scheduleId} onChange={(event) => changeSchedule(event.target.value)}>
            {schedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {scheduleDays[schedule.dayOfWeek]} · {schedule.startTime} - {schedule.endTime}
              </option>
            ))}
          </DsSelect>
        </DsField>
      ) : null}
      <div className="ds-grid-fields">
        <DsField label="Thứ trong tuần" htmlFor="req-day">
          <DsSelect id="req-day" value={proposal.dayOfWeek} onChange={(event) => update("dayOfWeek", Number(event.target.value))}>
            {scheduleDays.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </DsSelect>
        </DsField>
        <DsField label="Thời lượng khung giờ (phút)" htmlFor="req-duration">
          <DsInput id="req-duration" type="number" min={5} max={240} value={proposal.slotDuration} required onChange={(event) => update("slotDuration", Number(event.target.value) || 0)} />
        </DsField>
        <DsField label="Bắt đầu" htmlFor="req-start">
          <DsInput id="req-start" type="time" value={proposal.startTime} required onChange={(event) => update("startTime", event.target.value)} />
        </DsField>
        <DsField label="Kết thúc" htmlFor="req-end">
          <DsInput id="req-end" type="time" value={proposal.endTime} required onChange={(event) => update("endTime", event.target.value)} />
        </DsField>
        <DsField label="Số người khám tối đa mỗi khung giờ" htmlFor="req-max">
          <DsInput id="req-max" type="number" min={1} max={20} value={proposal.maxPatients} required onChange={(event) => update("maxPatients", Number(event.target.value) || 0)} />
        </DsField>
        <DsField label="Ngày dự kiến áp dụng" htmlFor="req-effective">
          <VietnamDateInput value={effectiveFrom} min={getVietnamDateInput()} onChange={setEffectiveFrom} ariaLabel="Ngày dự kiến áp dụng" className="ds-input" required />
        </DsField>
      </div>
      <DsField label="Lý do" htmlFor="req-reason" required hint="Ít nhất 5 ký tự">
        <DsTextarea id="req-reason" rows={3} value={reason} minLength={5} required onChange={(event) => setReason(event.target.value.slice(0, 500))} />
      </DsField>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <DsButton onClick={onCancel}>Đóng</DsButton>
        <DsButton type="submit" variant="primary" disabled={submitting || reason.trim().length < 5}>
          <Send aria-hidden="true" />
          {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
        </DsButton>
      </div>
    </form>
  );
}
