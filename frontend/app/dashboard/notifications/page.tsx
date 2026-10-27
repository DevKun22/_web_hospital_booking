"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import {
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardStatusBadge,
  DashboardSurface,
} from "@/components/dashboard/dashboard-ui";
import { apiRequest } from "@/lib/api";
import { useDashboardDepartments } from "@/lib/dashboard-departments-query";
import {
  formatVietnamDateTime,
  fromVietnamDateTimeInput,
} from "@/lib/date";

type Announcement = {
  campaignId: string;
  title: string;
  body: string;
  recipientCount: number;
  deliverySummary: Record<string, number>;
  scheduledAt: string;
  publishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string } | null;
  expiresAt: string | null;
  audience: AnnouncementAudience;
  departmentId?: string | null;
  departmentName?: string | null;
};

type AnnouncementAudience =
  | "ALL_PATIENTS"
  | "UPCOMING_APPOINTMENTS"
  | "DEPARTMENT_APPOINTMENTS";

const audienceLabels: Record<AnnouncementAudience, string> = {
  ALL_PATIENTS: "Tất cả bệnh nhân đang hoạt động",
  UPCOMING_APPOINTMENTS: "Người bệnh có lịch khám sắp tới",
  DEPARTMENT_APPOINTMENTS: "Người bệnh có lịch sắp tới theo chuyên khoa",
};

type CreateResult = Omit<Announcement, "deliverySummary" | "createdBy" | "createdAt" | "cancelledAt"> & {
  deliveryCount: number;
};

const inputClass =
  "mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]";

export default function DashboardNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("ALL_PATIENTS");
  const [departmentId, setDepartmentId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const announcementsQuery = useQuery({
    queryKey: ["dashboard", "notifications"],
    queryFn: () =>
      apiRequest<{ items: Announcement[] }>("/dashboard/notifications", {
        query: { limit: 20 },
      }),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const items = announcementsQuery.data?.items ?? [];
  const departmentsQuery = useDashboardDepartments({ isActive: "true", limit: 100 });
  const departments = departmentsQuery.data?.items ?? [];
  const canSubmit = useMemo(
    () =>
      title.trim().length >= 3 &&
      body.trim().length >= 5 &&
      (sendMode === "now" || Boolean(scheduledAt)) &&
      (audience !== "DEPARTMENT_APPOINTMENTS" || Boolean(departmentId)) &&
      (!expiresAt || sendMode === "now" || expiresAt > scheduledAt),
    [audience, body, departmentId, expiresAt, scheduledAt, sendMode, title],
  );

  const requestConfirmation = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!canSubmit) {
      setMessage({ tone: "error", text: "Vui lòng nhập đủ tiêu đề, nội dung và thời gian gửi." });
      return;
    }
    setConfirming(true);
  };

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await apiRequest<CreateResult>("/dashboard/notifications", {
        method: "POST",
        body: {
          title: title.trim(),
          body: body.trim(),
          scheduledAt:
            sendMode === "schedule"
              ? fromVietnamDateTimeInput(scheduledAt)
              : undefined,
          expiresAt: expiresAt ? fromVietnamDateTimeInput(expiresAt) : undefined,
          audience,
          departmentId:
            audience === "DEPARTMENT_APPOINTMENTS" ? departmentId : undefined,
        },
      });
      setConfirming(false);
      setTitle("");
      setBody("");
      setScheduledAt("");
      setExpiresAt("");
      setAudience("ALL_PATIENTS");
      setDepartmentId("");
      setSendMode("now");
      setComposerOpen(false);
      setMessage({
        tone: "success",
        text: result.publishedAt
          ? `Đã tạo thông báo cho ${result.recipientCount} người bệnh.`
          : `Đã lên lịch thông báo cho ${result.recipientCount} người bệnh.`,
      });
      await announcementsQuery.refetch();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Không thể tạo thông báo.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelScheduled = async (campaignId: string) => {
    if (!window.confirm("Hủy lịch gửi thông báo này? Chiến dịch sẽ không được phát hành tự động.")) return;
    setCancellingId(campaignId);
    setMessage(null);
    try {
      await apiRequest(`/dashboard/notifications/${campaignId}/cancel`, {
        method: "PATCH",
      });
      setMessage({ tone: "success", text: "Đã hủy lịch gửi thông báo." });
      await announcementsQuery.refetch();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Không thể hủy lịch gửi.",
      });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Giao tiếp với người bệnh"
        title="Thông báo ứng dụng"
        description="Soạn một lần, hệ thống lưu vào hộp thư của người bệnh và chuyển phát thông báo đẩy theo lựa chọn của từng tài khoản."
        actions={
          <>
            {!composerOpen ? <button type="button" onClick={() => setComposerOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:opacity-90"><BellRing className="h-4 w-4" />Soạn thông báo</button> : null}
            <button
              type="button"
              onClick={() => void announcementsQuery.refetch()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)]"
            >
              <RefreshCw className={`h-4 w-4 ${announcementsQuery.isFetching ? "animate-spin" : ""}`} />
              Làm mới
            </button>
          </>
        }
      />

      <DashboardFeedback
        error={message?.tone === "error" ? message.text : undefined}
        notice={message?.tone === "success" ? message.text : undefined}
        onDismiss={() => setMessage(null)}
      />

      <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${composerOpen ? "xl:grid-cols-[minmax(0,1fr)_430px]" : "xl:grid-cols-1"}`}>
        {composerOpen ? (
        <aside className="min-w-0 xl:order-2">
        <DashboardWorkspace
          open={composerOpen}
          onOpenChange={setComposerOpen}
          title="Soạn thông báo"
          description="Chọn đúng nhóm người nhận, thời điểm gửi và thời hạn hiển thị."
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold">Soạn thông báo mới</h2>
              <p className="text-sm text-[var(--text-muted)]">Chọn đúng nhóm người nhận để hạn chế thông báo không liên quan.</p>
            </div>
          </div>

          <form onSubmit={requestConfirmation} className="mt-6 space-y-5">
            <fieldset>
              <legend className="text-sm font-medium">Nhóm người nhận</legend>
              <div className="mt-2 grid gap-2">
                {(Object.keys(audienceLabels) as AnnouncementAudience[]).map((value) => (
                  <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${audience === value ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)]"}`}>
                    <input
                      type="radio"
                      name="audience"
                      checked={audience === value}
                      onChange={() => {
                        setAudience(value);
                        if (value !== "DEPARTMENT_APPOINTMENTS") setDepartmentId("");
                      }}
                    />
                    <span className="font-semibold">{audienceLabels[value]}</span>
                  </label>
                ))}
              </div>
              {audience === "DEPARTMENT_APPOINTMENTS" ? (
                <select
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  className={inputClass}
                  aria-label="Chọn chuyên khoa"
                >
                  <option value="">Chọn chuyên khoa</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              ) : null}
            </fieldset>

            <label className="block text-sm font-medium">
              Tiêu đề <span className="text-red-600">*</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                className={inputClass}
                placeholder="Ví dụ: Thay đổi giờ làm việc cuối tuần"
              />
              <span className="mt-1 block text-right text-xs text-[var(--text-muted)]">{title.length}/120</span>
            </label>

            <label className="block text-sm font-medium">
              Nội dung <span className="text-red-600">*</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={1000}
                rows={7}
                className={`${inputClass} resize-y leading-6`}
                placeholder="Nội dung ngắn gọn, rõ hành động người bệnh cần thực hiện."
              />
              <span className="mt-1 block text-right text-xs text-[var(--text-muted)]">{body.length}/1000</span>
            </label>

            <fieldset>
              <legend className="text-sm font-medium">Thời điểm phát hành</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["now", "schedule"] as const).map((mode) => (
                  <label key={mode} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${sendMode === mode ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)]"}`}>
                    <input type="radio" name="sendMode" checked={sendMode === mode} onChange={() => setSendMode(mode)} />
                    {mode === "now" ? <Send className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                    <span className="font-semibold">{mode === "now" ? "Gửi ngay" : "Hẹn giờ"}</span>
                  </label>
                ))}
              </div>
              {sendMode === "schedule" ? (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className={inputClass}
                />
              ) : null}
            </fieldset>

            <label className="block text-sm font-medium">
              Tự ẩn sau thời điểm (tùy chọn)
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-[var(--text-muted)]">Sau thời điểm này thông báo không còn hiển thị trong hộp thư và không được gửi đến thiết bị.</span>
            </label>

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Send className="h-4 w-4" />
              Xem lại trước khi gửi
            </button>
          </form>
        </DashboardWorkspace>
        </aside>
        ) : null}

        <DashboardSurface className="overflow-hidden xl:order-1">
          <div className="border-b border-[var(--border-soft)] p-5">
            <h2 className="font-semibold">Lịch sử chiến dịch</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Theo dõi phạm vi và trạng thái chuyển phát gần đây.</p>
          </div>
          {announcementsQuery.isLoading ? <p className="p-5 text-sm text-[var(--text-muted)]">Đang tải lịch sử...</p> : null}
          {announcementsQuery.error ? <p className="m-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{announcementsQuery.error instanceof Error ? announcementsQuery.error.message : "Không tải được lịch sử."}</p> : null}
          {!announcementsQuery.isLoading && !announcementsQuery.error && items.length === 0 ? (
            <div className="p-5"><DashboardEmptyState title="Chưa có chiến dịch" description="Thông báo đầu tiên sẽ xuất hiện tại đây sau khi được tạo." /></div>
          ) : null}
          <div className="divide-y divide-[var(--border-soft)]">
            {items.map((item) => {
              const sent = item.deliverySummary.SENT ?? 0;
              const failed = (item.deliverySummary.FAILED ?? 0) + (item.deliverySummary.EXHAUSTED ?? 0) + (item.deliverySummary.INVALID_TOKEN ?? 0);
              const isScheduled = !item.publishedAt && !item.cancelledAt;
              return (
                <article key={item.campaignId} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--text-muted)]">{item.body}</p>
                    </div>
                    <DashboardStatusBadge className="shrink-0" tone={item.cancelledAt ? "danger" : isScheduled ? "warning" : "positive"}>
                      {item.cancelledAt ? "Đã hủy" : isScheduled ? "Đã lên lịch" : "Đã phát hành"}
                    </DashboardStatusBadge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-2">
                    <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {item.recipientCount} người nhận</span>
                    <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {sent} thông báo đẩy đã gửi</span>
                    <span className="sm:col-span-2">{item.departmentName ?? audienceLabels[item.audience]}</span>
                    {failed > 0 ? <span className="inline-flex items-center gap-1.5 text-red-700"><XCircle className="h-3.5 w-3.5" /> {failed} thông báo gửi lỗi</span> : null}
                    {item.expiresAt ? <span>Ẩn sau {formatVietnamDateTime(item.expiresAt)}</span> : null}
                    <span className="sm:col-span-2">{isScheduled ? `Gửi lúc ${formatVietnamDateTime(item.scheduledAt)}` : `Tạo lúc ${formatVietnamDateTime(item.createdAt)}`} · {item.createdBy?.fullName ?? "Tài khoản hệ thống"}</span>
                  </div>
                  {isScheduled ? (
                    <button type="button" disabled={cancellingId === item.campaignId} onClick={() => void cancelScheduled(item.campaignId)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:underline disabled:cursor-wait disabled:opacity-60">
                      {cancellingId === item.campaignId ? <RefreshCw className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} {cancellingId === item.campaignId ? "Đang hủy..." : "Hủy lịch gửi"}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </DashboardSurface>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="announcement-confirm-title">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] p-6 shadow-2xl">
            <h2 id="announcement-confirm-title" className="text-xl font-semibold">Xác nhận {sendMode === "now" ? "gửi thông báo" : "lên lịch gửi"}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Thông báo sẽ được lưu trong hộp thư của đúng nhóm đã chọn. Việc gửi thông báo đẩy tuân theo lựa chọn của từng tài khoản.</p>
            <p className="mt-2 text-sm font-semibold text-[var(--primary)]">{audience === "DEPARTMENT_APPOINTMENTS" ? departments.find((item) => item.id === departmentId)?.name : audienceLabels[audience]}</p>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="font-semibold">{title.trim()}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-soft)]">{body.trim()}</p>
              {sendMode === "schedule" ? <p className="mt-3 text-xs font-semibold text-[var(--primary)]">Dự kiến: {formatVietnamDateTime(fromVietnamDateTimeInput(scheduledAt))}</p> : null}
              {expiresAt ? <p className="mt-1 text-xs text-[var(--text-muted)]">Tự ẩn: {formatVietnamDateTime(fromVietnamDateTimeInput(expiresAt))}</p> : null}
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={submitting} onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">Quay lại chỉnh sửa</button>
              <button type="button" disabled={submitting} onClick={() => void submit()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Đang xử lý..." : sendMode === "now" ? "Xác nhận gửi" : "Xác nhận lên lịch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
