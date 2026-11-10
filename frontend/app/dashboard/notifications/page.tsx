"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BellRing, RefreshCw } from "lucide-react";
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
  type DsTone,
} from "@/components/ds";
import { VietnamDateTimeInput } from "@/components/ui/vietnam-datetime-input";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardDepartments } from "@/lib/dashboard-departments-query";
import { useDashboardUsers } from "@/lib/dashboard-users-query";
import { dashboardRoleLabels } from "@/lib/dashboard-navigation";
import { can } from "@/lib/permissions";
import { formatVietnamDateTime, fromVietnamDateTimeInput } from "@/lib/date";

// Thông báo ứng dụng: lịch sử chiến dịch bên trái; chọn một chiến dịch hoặc bấm "Soạn thông báo" thì khung bên phải mở cạnh danh sách.
// Bước xem lại trước khi gửi nằm ngay trong khung (không còn hộp thoại phủ màn hình).

type AnnouncementAudience =
  | "ALL_PATIENTS"
  | "UPCOMING_APPOINTMENTS"
  | "DEPARTMENT_APPOINTMENTS"
  | "ALL_STAFF"
  | "ROLE_DOCTOR"
  | "ROLE_PHARMACIST"
  | "ROLE_RECEPTION"
  | "ONE_USER";

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

type CreateResult = { recipientCount: number; publishedAt: string | null };

const audienceLabels: Record<AnnouncementAudience, string> = {
  ALL_PATIENTS: "Tất cả người khám đang hoạt động",
  UPCOMING_APPOINTMENTS: "Người bệnh có lịch khám sắp tới",
  DEPARTMENT_APPOINTMENTS: "Người bệnh có lịch sắp tới theo chuyên khoa",
  ALL_STAFF: "Tất cả nhân sự bệnh viện",
  ROLE_DOCTOR: "Chỉ bác sĩ",
  ROLE_PHARMACIST: "Chỉ dược sĩ",
  ROLE_RECEPTION: "Chỉ nhân viên tiếp nhận",
  ONE_USER: "Một nhân sự cụ thể",
};

const patientAudiences: AnnouncementAudience[] = ["ALL_PATIENTS", "UPCOMING_APPOINTMENTS", "DEPARTMENT_APPOINTMENTS"];
const staffAudiences: AnnouncementAudience[] = ["ALL_STAFF", "ROLE_DOCTOR", "ROLE_PHARMACIST", "ROLE_RECEPTION", "ONE_USER"];

type CampaignStatus = "PUBLISHED" | "SCHEDULED" | "CANCELLED";

const campaignStatus = (item: Announcement): CampaignStatus => (item.cancelledAt ? "CANCELLED" : item.publishedAt ? "PUBLISHED" : "SCHEDULED");
const statusLabel: Record<CampaignStatus, string> = { PUBLISHED: "Đã phát hành", SCHEDULED: "Đã lên lịch", CANCELLED: "Đã hủy" };
const statusTone: Record<CampaignStatus, DsTone> = { PUBLISHED: "good", SCHEDULED: "warn", CANCELLED: "bad" };

const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "PUBLISHED", label: "Đã phát hành" },
  { id: "SCHEDULED", label: "Đã lên lịch" },
  { id: "CANCELLED", label: "Đã hủy" },
];

type PaneState = { kind: "compose" } | { kind: "view"; id: string } | null;

export default function DashboardNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("ALL_PATIENTS");
  const [departmentId, setDepartmentId] = useState("");
  const [userId, setUserId] = useState("");
  const { user: currentUser } = useAuth();
  const canPickUser = can(currentUser, "user.manage");
  const usersQuery = useDashboardUsers(useMemo(() => ({ isActive: "true", limit: 100 }), []), canPickUser);
  const staffUsers = usersQuery.data?.items ?? [];
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pane, setPane] = useState<PaneState>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const announcementsQuery = useQuery({
    queryKey: ["dashboard", "notifications"],
    queryFn: () => apiRequest<{ items: Announcement[] }>("/dashboard/notifications", { query: { limit: 50 } }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const allItems = announcementsQuery.data?.items ?? [];
  const items = statusFilter ? allItems.filter((item) => campaignStatus(item) === statusFilter) : allItems;
  const departmentsQuery = useDashboardDepartments(useMemo(() => ({ isActive: "true", limit: 100 }), []));
  const departments = departmentsQuery.data?.items ?? [];
  const selected = pane?.kind === "view" ? allItems.find((item) => item.campaignId === pane.id) ?? null : null;
  const open = pane?.kind === "compose" || (pane?.kind === "view" && Boolean(selected));

  useEffect(() => {
    if (!message) return;
    const timeoutId = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const canSubmit =
    title.trim().length >= 3 &&
    body.trim().length >= 5 &&
    (sendMode === "now" || Boolean(scheduledAt)) &&
    (audience !== "DEPARTMENT_APPOINTMENTS" || Boolean(departmentId)) &&
    (audience !== "ONE_USER" || Boolean(userId)) &&
    (!expiresAt || sendMode === "now" || expiresAt > scheduledAt);

  const startCompose = () => {
    setConfirming(false);
    setMessage(null);
    setPane({ kind: "compose" });
  };

  const closePane = () => {
    setPane(null);
    setConfirming(false);
    setConfirmCancel(false);
  };

  const requestConfirmation = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!canSubmit) {
      setMessage({ tone: "bad", text: "Vui lòng nhập đủ tiêu đề, nội dung và thời gian gửi." });
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
          scheduledAt: sendMode === "schedule" ? fromVietnamDateTimeInput(scheduledAt) : undefined,
          expiresAt: expiresAt ? fromVietnamDateTimeInput(expiresAt) : undefined,
          audience,
          departmentId: audience === "DEPARTMENT_APPOINTMENTS" ? departmentId : undefined,
          userId: audience === "ONE_USER" ? userId : undefined,
        },
      });
      setConfirming(false);
      setTitle("");
      setBody("");
      setScheduledAt("");
      setExpiresAt("");
      setAudience("ALL_PATIENTS");
      setDepartmentId("");
      setUserId("");
      setSendMode("now");
      closePane();
      setMessage({
        tone: "good",
        text: result.publishedAt ? `Đã tạo thông báo cho ${result.recipientCount} người nhận.` : `Đã lên lịch thông báo cho ${result.recipientCount} người nhận.`,
      });
      await announcementsQuery.refetch();
    } catch (error) {
      setConfirming(false);
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "Không thể tạo thông báo." });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelScheduled = async (campaignId: string) => {
    setCancelling(true);
    setMessage(null);
    try {
      await apiRequest(`/dashboard/notifications/${campaignId}/cancel`, { method: "PATCH" });
      setMessage({ tone: "good", text: "Đã hủy lịch gửi thông báo." });
      setConfirmCancel(false);
      await announcementsQuery.refetch();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "Không thể hủy lịch gửi." });
    } finally {
      setCancelling(false);
    }
  };

  const queryErrorMessage = announcementsQuery.error ? (announcementsQuery.error instanceof Error ? announcementsQuery.error.message : "Không tải được lịch sử.") : "";

  const columns: DsColumn<Announcement>[] = [
    {
      key: "title",
      header: "Thông báo",
      cell: (row) => (
        <div>
          <strong>{row.title}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.body}</div>
        </div>
      ),
    },
    { key: "audience", header: "Nhóm nhận", cell: (row) => row.departmentName ?? audienceLabels[row.audience] },
    { key: "recipients", header: "Người nhận", align: "num", cell: (row) => row.recipientCount },
    { key: "sent", header: "Đẩy đã gửi", align: "num", cell: (row) => row.deliverySummary.SENT ?? 0 },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => {
        const status = campaignStatus(row);
        return (
          <div>
            <DsStatusPill tone={statusTone[status]}>{statusLabel[status]}</DsStatusPill>
            <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{formatVietnamDateTime(status === "SCHEDULED" ? row.scheduledAt : row.createdAt)}</div>
          </div>
        );
      },
    },
  ];

  const list = (
    <DsPanel flush>
      <DsToolbar>
        <DsButton variant="primary" onClick={startCompose}>
          <BellRing aria-hidden="true" />
          Soạn thông báo
        </DsButton>
        <DsButton onClick={() => void announcementsQuery.refetch()}>
          <RefreshCw aria-hidden="true" className={announcementsQuery.isFetching ? "animate-spin" : undefined} />
          Làm mới
        </DsButton>
      </DsToolbar>
      <DsTabs label="Lọc chiến dịch theo trạng thái" items={statusTabs} value={statusFilter} onChange={setStatusFilter} />
      {open ? (
        items.length ? (
          <div role="listbox" aria-label="Lịch sử chiến dịch">
            {items.map((item) => {
              const status = campaignStatus(item);
              return (
                <button key={item.campaignId} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "view" && pane.id === item.campaignId} onClick={() => { setConfirmCancel(false); setPane({ kind: "view", id: item.campaignId }); }}>
                  <span className="ds-listrow__main">
                    <strong>{item.title}</strong>
                    <small>
                      {item.recipientCount} người nhận · {formatVietnamDateTime(status === "SCHEDULED" ? item.scheduledAt : item.createdAt)}
                    </small>
                  </span>
                  <DsStatusPill tone={statusTone[status]}>{statusLabel[status]}</DsStatusPill>
                </button>
              );
            })}
          </div>
        ) : (
          <DsEmptyState title="Chưa có chiến dịch" />
        )
      ) : (
        <DsDataTable
          caption="Lịch sử chiến dịch thông báo"
          columns={columns}
          rows={items}
          rowKey={(row) => row.campaignId}
          loading={announcementsQuery.isLoading}
          emptyTitle="Chưa có chiến dịch"
          emptyDescription="Thông báo đầu tiên sẽ xuất hiện tại đây sau khi được tạo."
          onRowClick={(row) => { setConfirmCancel(false); setPane({ kind: "view", id: row.campaignId }); }}
        />
      )}
      {allItems.length >= 50 ? <p className="ds-hint" style={{ margin: 0, padding: "10px 16px" }}>Hiển thị 50 chiến dịch gần nhất.</p> : null}
    </DsPanel>
  );

  const departmentName = departments.find((item) => item.id === departmentId)?.name;

  const composePane =
    pane?.kind === "compose" ? (
      <DsPane title={confirming ? `Xác nhận ${sendMode === "now" ? "gửi thông báo" : "lên lịch gửi"}` : "Soạn thông báo"} onClose={closePane}>
        {confirming ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="ds-hint" style={{ margin: 0 }}>
              Thông báo sẽ được lưu trong hộp thư của đúng nhóm đã chọn. Việc gửi thông báo đẩy tuân theo lựa chọn của từng tài khoản.
            </p>
            <div className="ds-card">
              <div className="ds-card__head">
                <h3>{title.trim()}</h3>
              </div>
              <div className="ds-card__body">
                <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{body.trim()}</p>
                <DsKeyValue
                  items={[
                    { label: "Nhóm nhận", value: audience === "DEPARTMENT_APPOINTMENTS" ? departmentName || "-" : audienceLabels[audience] },
                    ...(sendMode === "schedule" ? [{ label: "Dự kiến gửi", value: formatVietnamDateTime(fromVietnamDateTimeInput(scheduledAt)) }] : [{ label: "Gửi", value: "Ngay sau khi xác nhận" }]),
                    ...(expiresAt ? [{ label: "Tự ẩn", value: formatVietnamDateTime(fromVietnamDateTimeInput(expiresAt)) }] : []),
                  ]}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <DsButton disabled={submitting} onClick={() => setConfirming(false)}>
                Quay lại chỉnh sửa
              </DsButton>
              <DsButton variant="primary" disabled={submitting} onClick={() => void submit()}>
                {submitting ? "Đang xử lý..." : sendMode === "now" ? "Xác nhận gửi" : "Xác nhận lên lịch"}
              </DsButton>
            </div>
          </div>
        ) : (
          <form onSubmit={requestConfirmation} style={{ display: "grid", gap: 12 }} aria-label="Soạn thông báo mới">
            <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 8 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nhóm người nhận</legend>
              {[
                { title: "Gửi cho người khám", values: patientAudiences },
                { title: "Gửi cho nhân sự bệnh viện", values: staffAudiences.filter((value) => value !== "ONE_USER" || canPickUser) },
              ].map((group) => (
                <div key={group.title} style={{ display: "grid", gap: 8 }}>
                  <span className="ds-hint" style={{ fontWeight: 600 }}>{group.title}</span>
                  {group.values.map((value) => (
                    <label key={value} className="ds-check" style={{ cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="audience"
                        checked={audience === value}
                        style={{ marginTop: 3 }}
                        onChange={() => {
                          setAudience(value);
                          if (value !== "DEPARTMENT_APPOINTMENTS") setDepartmentId("");
                          if (value !== "ONE_USER") setUserId("");
                        }}
                      />
                      <span>
                        <strong>{audienceLabels[value]}</strong>
                      </span>
                    </label>
                  ))}
                </div>
              ))}
              {audience === "ONE_USER" ? (
                <DsSelect aria-label="Chọn nhân sự nhận thông báo" value={userId} onChange={(event) => setUserId(event.target.value)}>
                  <option value="">Chọn nhân sự</option>
                  {staffUsers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName} ({dashboardRoleLabels[item.role as keyof typeof dashboardRoleLabels] ?? item.role})
                    </option>
                  ))}
                </DsSelect>
              ) : null}
              {audience === "DEPARTMENT_APPOINTMENTS" ? (
                <DsSelect aria-label="Chọn chuyên khoa" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  <option value="">Chọn chuyên khoa</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </DsSelect>
              ) : null}
            </fieldset>
            <DsField label="Tiêu đề" htmlFor="ann-title" required hint={`${title.length}/120`}>
              <DsInput id="ann-title" value={title} maxLength={120} placeholder="Ví dụ: Thay đổi giờ làm việc cuối tuần" onChange={(event) => setTitle(event.target.value)} />
            </DsField>
            <DsField label="Nội dung" htmlFor="ann-body" required hint={`${body.length}/1000 · ngắn gọn, rõ hành động người khám cần thực hiện`}>
              <DsTextarea id="ann-body" rows={6} value={body} maxLength={1000} onChange={(event) => setBody(event.target.value)} />
            </DsField>
            <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 8 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Thời điểm phát hành</legend>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {(["now", "schedule"] as const).map((mode) => (
                  <label key={mode} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" name="sendMode" checked={sendMode === mode} onChange={() => setSendMode(mode)} />
                    <strong style={{ fontSize: 13 }}>{mode === "now" ? "Gửi ngay" : "Hẹn giờ"}</strong>
                  </label>
                ))}
              </div>
              {sendMode === "schedule" ? <VietnamDateTimeInput value={scheduledAt} onChange={setScheduledAt} ariaLabel="Thời điểm gửi" className="ds-input" /> : null}
            </fieldset>
            <DsField label="Tự ẩn sau thời điểm (tùy chọn)" htmlFor="ann-expires" hint="Sau thời điểm này thông báo không còn hiển thị trong hộp thư và không được gửi đến thiết bị.">
              <VietnamDateTimeInput value={expiresAt} onChange={setExpiresAt} ariaLabel="Thời điểm tự ẩn" className="ds-input" />
            </DsField>
            {expiresAt && sendMode === "schedule" && expiresAt <= scheduledAt ? <DsNotice tone="warn">Thời điểm tự ẩn phải sau thời điểm gửi.</DsNotice> : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
              {!canSubmit ? <span className="ds-hint">Cần tiêu đề (3 ký tự trở lên), nội dung (5 ký tự trở lên) và nhóm nhận.</span> : null}
              <DsButton onClick={closePane}>Hủy</DsButton>
              <DsButton type="submit" variant="primary" disabled={!canSubmit}>
                Xem lại trước khi gửi
              </DsButton>
            </div>
          </form>
        )}
      </DsPane>
    ) : null;

  const viewPane = selected ? (
    <DsPane title={selected.title} badge={<DsStatusPill tone={statusTone[campaignStatus(selected)]}>{statusLabel[campaignStatus(selected)]}</DsStatusPill>} onClose={closePane}>
      <div style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selected.body}</p>
        <DsKeyValue
          items={[
            { label: "Nhóm nhận", value: selected.departmentName ?? audienceLabels[selected.audience] },
            { label: "Người nhận", value: selected.recipientCount },
            { label: "Thông báo đẩy đã gửi", value: selected.deliverySummary.SENT ?? 0 },
            {
              label: "Gửi lỗi",
              value: (selected.deliverySummary.FAILED ?? 0) + (selected.deliverySummary.EXHAUSTED ?? 0) + (selected.deliverySummary.INVALID_TOKEN ?? 0),
            },
            { label: campaignStatus(selected) === "SCHEDULED" ? "Gửi lúc" : "Tạo lúc", value: formatVietnamDateTime(campaignStatus(selected) === "SCHEDULED" ? selected.scheduledAt : selected.createdAt) },
            ...(selected.expiresAt ? [{ label: "Tự ẩn sau", value: formatVietnamDateTime(selected.expiresAt) }] : []),
            { label: "Người tạo", value: selected.createdBy?.fullName ?? "Tài khoản hệ thống" },
          ]}
        />
        {campaignStatus(selected) === "SCHEDULED" ? (
          confirmCancel ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}>Hủy lịch gửi? Chiến dịch sẽ không được phát hành tự động.</span>
              <DsButton variant="danger" disabled={cancelling} onClick={() => void cancelScheduled(selected.campaignId)}>
                {cancelling ? "Đang hủy..." : "Hủy lịch gửi"}
              </DsButton>
              <DsButton onClick={() => setConfirmCancel(false)}>Giữ lịch</DsButton>
            </div>
          ) : (
            <div>
              <DsButton variant="danger" onClick={() => setConfirmCancel(true)}>
                Hủy lịch gửi
              </DsButton>
            </div>
          )
        ) : null}
      </div>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader title="Thông báo ứng dụng" description="Soạn một lần, gửi cho người khám (hộp thư và thông báo đẩy theo lựa chọn của từng tài khoản) hoặc cho nhân sự bệnh viện (hộp thư “Thông báo của tôi”)" />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {queryErrorMessage ? <DsNotice tone="bad">{queryErrorMessage}</DsNotice> : null}
        {message ? <DsNotice tone={message.tone}>{message.text}</DsNotice> : null}
      </div>
      <DsSplit list={list} pane={composePane ?? viewPane} />
    </>
  );
}
