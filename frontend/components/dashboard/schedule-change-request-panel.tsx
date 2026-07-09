"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Send, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { formatVietnamDate, getVietnamDateInput } from "@/lib/date";
import { queryKeys } from "@/lib/query-keys";
import type {
  DoctorSchedule,
  ListResult,
  ScheduleChangeRequest,
  ScheduleChangeRequestStatus,
  ScheduleChangeRequestType,
} from "@/lib/types";

type Props = {
  isDoctor: boolean;
  schedules: DoctorSchedule[];
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};
type Proposal = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  maxPatients: number;
};

const text = {
  days: [
    "Chủ nhật",
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
  ],
  doctorTitle: "Yêu cầu đổi lịch",
  managerTitle: "Yêu cầu đổi lịch chờ duyệt",
  doctorDescription:
    "Lịch mẫu chỉ thay đổi sau khi được duyệt. Slot đã đặt luôn được giữ nguyên.",
  managerDescription:
    "Duyệt yêu cầu sẽ cập nhật lịch mẫu; slot đã sinh và lịch đã đặt không tự thay đổi.",
  missingSchedule:
    "Hãy chọn lịch mẫu cần thay đổi",
  sent: "Đã gửi yêu cầu đổi lịch. Staff/Admin sẽ xem và duyệt.",
  rejectedReason:
    "Cần nêu lý do từ chối yêu cầu",
  approved:
    "Đã duyệt và áp dụng lịch mẫu. Slot đã sinh/đặt không bị đổi tự động.",
  rejected:
    "Đã từ chối yêu cầu đổi lịch.",
  cancelled: "Đã hủy yêu cầu đổi lịch.",
};

const typeLabels: Record<ScheduleChangeRequestType, string> = {
  CREATE_WEEKLY_SCHEDULE: "Tạo lịch mẫu mới",
  UPDATE_WEEKLY_SCHEDULE: "Điều chỉnh lịch mẫu",
  DEACTIVATE_WEEKLY_SCHEDULE: "Tạm ngừng lịch mẫu",
};
const statusLabels: Record<ScheduleChangeRequestStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  CANCELLED: "Đã hủy",
};
const statusClasses: Record<ScheduleChangeRequestStatus, string> = {
  PENDING: "bg-[#fff4d6] text-[#8a5a00]",
  APPROVED: "bg-[#e7f6ed] text-[#1f7a3a]",
  REJECTED: "bg-[#fff0ef] text-[#b3261e]",
  CANCELLED: "bg-[#eef2f7] text-[#667892]",
};
const initialProposal: Proposal = {
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "11:30",
  slotDuration: 30,
  maxPatients: 1,
};

export function ScheduleChangeRequestPanel({
  isDoctor,
  schedules,
  onNotice,
  onError,
}: Props) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<ScheduleChangeRequestType>(
    "UPDATE_WEEKLY_SCHEDULE",
  );
  const [scheduleId, setScheduleId] = useState("");
  const [proposal, setProposal] = useState<Proposal>(initialProposal);
  const [effectiveFrom, setEffectiveFrom] = useState(getVietnamDateInput());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const filters = useMemo(
    () => ({ status: isDoctor ? undefined : "PENDING", limit: 20 }),
    [isDoctor],
  );
  const requestsQuery = useQuery({
    queryKey: queryKeys.dashboardScheduleChangeRequests(filters),
    queryFn: () =>
      apiRequest<ListResult<ScheduleChangeRequest>>(
        "/dashboard/schedule-change-requests",
        { query: filters },
      ),
  });
  const selectedSchedule =
    schedules.find((schedule) => schedule.id === scheduleId) || null;
  const requests = requestsQuery.data?.items || [];

  useEffect(() => {
    if (type === "CREATE_WEEKLY_SCHEDULE" || scheduleId || !schedules[0]) return;
    const timeoutId = window.setTimeout(() => setScheduleId(schedules[0].id), 0);
    return () => window.clearTimeout(timeoutId);
  }, [scheduleId, schedules, type]);
  useEffect(() => {
    if (!selectedSchedule) return;
    const timeoutId = window.setTimeout(
      () => setProposal({
        dayOfWeek: selectedSchedule.dayOfWeek,
        startTime: selectedSchedule.startTime,
        endTime: selectedSchedule.endTime,
        slotDuration: selectedSchedule.slotDuration,
        maxPatients: selectedSchedule.maxPatients,
      }),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [selectedSchedule]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "schedule-change-requests"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "doctor-schedules"],
      }),
    ]);
  const updateProposal = <K extends keyof Proposal>(
    key: K,
    value: Proposal[K],
  ) => setProposal((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (type !== "CREATE_WEEKLY_SCHEDULE" && !selectedSchedule)
      return onError(text.missingSchedule);
    setSubmitting(true);
    try {
      await apiRequest<ScheduleChangeRequest>(
        "/dashboard/schedule-change-requests",
        {
          method: "POST",
          body: {
            type,
            scheduleId:
              type === "CREATE_WEEKLY_SCHEDULE" ? null : selectedSchedule?.id,
            ...proposal,
            isActive: type !== "DEACTIVATE_WEEKLY_SCHEDULE",
            effectiveFrom,
            reason,
          },
        },
      );
      setReason("");
      onNotice(text.sent);
      await invalidate();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Không gửi được yêu cầu đổi lịch",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const review = async (id: string, status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && !reviewerNote.trim())
      return onError(text.rejectedReason);
    setSubmitting(true);
    try {
      await apiRequest<ScheduleChangeRequest>(
        `/dashboard/schedule-change-requests/${id}/review`,
        {
          method: "PATCH",
          body: { status, reviewerNote: reviewerNote.trim() || null },
        },
      );
      setRejectTarget(null);
      setReviewerNote("");
      onNotice(status === "APPROVED" ? text.approved : text.rejected);
      await invalidate();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Không xử lý được yêu cầu",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const cancel = async (id: string) => {
    setSubmitting(true);
    try {
      await apiRequest<ScheduleChangeRequest>(
        `/dashboard/schedule-change-requests/${id}/cancel`,
        { method: "PATCH" },
      );
      onNotice(text.cancelled);
      await invalidate();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Không hủy được yêu cầu",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-md border border-[#dce3ee] bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-[#e7f0fb] p-2 text-[#0d4f8b]">
          <Clock3 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {isDoctor ? text.doctorTitle : text.managerTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#667892]">
            {isDoctor ? text.doctorDescription : text.managerDescription}
          </p>
        </div>
      </div>
      {isDoctor ? (
        <form className="mt-5 space-y-3" onSubmit={submit}>
          <label className="block">
            <span className="text-sm font-medium text-[#334155]">
              {"Loại yêu cầu"}
            </span>
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as ScheduleChangeRequestType)
              }
              className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm"
            >
              <option value="UPDATE_WEEKLY_SCHEDULE">
                {typeLabels.UPDATE_WEEKLY_SCHEDULE}
              </option>
              <option value="DEACTIVATE_WEEKLY_SCHEDULE">
                {typeLabels.DEACTIVATE_WEEKLY_SCHEDULE}
              </option>
              <option value="CREATE_WEEKLY_SCHEDULE">
                {typeLabels.CREATE_WEEKLY_SCHEDULE}
              </option>
            </select>
          </label>
          {type !== "CREATE_WEEKLY_SCHEDULE" ? (
            <label className="block">
              <span className="text-sm font-medium text-[#334155]">
                {"Lịch mẫu"}
              </span>
              <select
                value={scheduleId}
                onChange={(event) => setScheduleId(event.target.value)}
                className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm"
              >
                {schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {text.days[schedule.dayOfWeek]} - {schedule.startTime}
                    {" đến "}
                    {schedule.endTime}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-[#334155]">
                {"Thứ trong tuần"}
              </span>
              <select
                value={proposal.dayOfWeek}
                onChange={(event) =>
                  updateProposal("dayOfWeek", Number(event.target.value))
                }
                className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm"
              >
                {text.days.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#334155]">
                {"Thời lượng slot"}
              </span>
              <input
                type="number"
                min={5}
                max={240}
                value={proposal.slotDuration}
                onChange={(event) =>
                  updateProposal(
                    "slotDuration",
                    Number(event.target.value) || 0,
                  )
                }
                className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#334155]">
                {"Bắt đầu"}
              </span>
              <input
                type="time"
                value={proposal.startTime}
                onChange={(event) =>
                  updateProposal("startTime", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#334155]">
                {"Kết thúc"}
              </span>
              <input
                type="time"
                value={proposal.endTime}
                onChange={(event) =>
                  updateProposal("endTime", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm"
                required
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-[#334155]">
              {"Số bệnh nhân tối đa mỗi slot"}
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={proposal.maxPatients}
              onChange={(event) =>
                updateProposal("maxPatients", Number(event.target.value) || 0)
              }
              className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#334155]">
              {"Ngày dự kiến áp dụng"}
            </span>
            <input
              type="date"
              value={effectiveFrom}
              min={getVietnamDateInput()}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#334155]">
              {"Lý do"}
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 500))}
              className="mt-1 w-full resize-y rounded-md border border-[#cfd8e6] px-3 py-2 text-sm"
              rows={3}
              minLength={5}
              required
            />
          </label>
          <button
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {"Gửi yêu cầu"}
          </button>
        </form>
      ) : null}
      <div className="mt-5 space-y-3">
        {requestsQuery.isLoading ? (
          <p className="text-sm text-[#667892]">
            {"Đang tải yêu cầu..."}
          </p>
        ) : null}
        {!requestsQuery.isLoading && requests.length === 0 ? (
          <p className="rounded-md border border-dashed border-[#dce3ee] px-3 py-4 text-sm text-[#667892]">
            {isDoctor
              ? "Bạn chưa có yêu cầu đổi lịch nào."
              : "Không có yêu cầu nào đang chờ duyệt."}
          </p>
        ) : null}
        {requests.map((request) => (
          <article
            key={request.id}
            className="rounded-md border border-[#e5ebf3] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#172033]">
                  {isDoctor
                    ? typeLabels[request.type]
                    : `${request.doctor.title ? `${request.doctor.title} ` : ""}${request.doctor.user.fullName}`}
                </p>
                <p className="mt-1 text-xs text-[#667892]">
                  {text.days[request.dayOfWeek]} - {request.startTime}
                  {" đến "}
                  {request.endTime}
                  {" - từ "}
                  {formatVietnamDate(request.effectiveFrom)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${statusClasses[request.status]}`}
              >
                {statusLabels[request.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#42526b]">{request.reason}</p>
            {request.reviewerNote ? (
              <p className="mt-2 rounded-md bg-[#f8fafc] px-2 py-1.5 text-xs text-[#667892]">
                {"Phản hồi: "}
                {request.reviewerNote}
              </p>
            ) : null}
            {isDoctor && request.status === "PENDING" ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void cancel(request.id)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#b3261e]"
              >
                <X className="h-3.5 w-3.5" />
                {"Hủy yêu cầu"}
              </button>
            ) : null}
            {!isDoctor && request.status === "PENDING" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void review(request.id, "APPROVED")}
                  className="inline-flex items-center gap-1 rounded-md bg-[#e7f6ed] px-2.5 py-1.5 text-xs font-semibold text-[#1f7a3a]"
                >
                  <Check className="h-3.5 w-3.5" />
                  {"Duyệt"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectTarget(request.id);
                    setReviewerNote("");
                  }}
                  className="rounded-md border border-[#f2b8b5] px-2.5 py-1.5 text-xs font-semibold text-[#b3261e]"
                >
                  {"Từ chối"}
                </button>
              </div>
            ) : null}
            {!isDoctor && rejectTarget === request.id ? (
              <div className="mt-3 flex gap-2">
                <input
                  value={reviewerNote}
                  onChange={(event) =>
                    setReviewerNote(event.target.value.slice(0, 500))
                  }
                  placeholder="Lý do từ chối"
                  className="min-w-0 flex-1 rounded-md border border-[#cfd8e6] px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void review(request.id, "REJECTED")}
                  className="rounded-md bg-[#b3261e] px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  {"Xác nhận"}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
