"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  DsToolbar,
  type DsColumn,
} from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useDashboardChatbotLogs,
  useDashboardChatbotOverview,
  useDashboardChatbotSession,
  useDashboardChatbotSessions,
  useDashboardChatbotSettings,
} from "@/lib/dashboard-chatbot-query";
import { formatVietnamDateTime } from "@/lib/date";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { ChatbotLog, ChatbotRuntimeValue, ChatbotSession, ChatbotSessionDetail, ChatbotSettings, Pagination } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Trợ lý tư vấn: bốn góc nhìn bằng tab (tổng quan, phiên, nhật ký, cấu hình). Ở tab Phiên, chọn một phiên thì khung chi tiết
// mở cạnh danh sách. Ô tìm gõ là lọc.

type TabKey = "overview" | "sessions" | "logs" | "settings";
type SettingsForm = ChatbotRuntimeValue;

const emptyPagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 1 };

const defaultSettings: SettingsForm = {
  aiEnabled: true,
  fallbackEnabled: true,
  faqEnabled: true,
  model: "gemini-2.5-flash",
  maxSuggestedActions: 3,
  sessionExpiresDays: 7,
};

const tabs: { id: TabKey; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "sessions", label: "Phiên" },
  { id: "logs", label: "Nhật ký" },
  { id: "settings", label: "Cấu hình" },
];

const formatDateTime = (value?: string | null) => (value ? formatVietnamDateTime(value) : "-");

const summarizeJson = (value: unknown) => {
  if (!value) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "-";
  }
};

const displayParticipant = (item: ChatbotSession | ChatbotSessionDetail | ChatbotLog) => item.guestPhone || item.user?.phone || item.user?.fullName || "Khách";

function Bar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{label}</span>
        <span className="ds-num">{count}</span>
      </div>
      <div style={{ marginTop: 4, height: 8, borderRadius: 999, background: "var(--ds-sunken)" }}>
        <div style={{ height: 8, borderRadius: 999, background: color, width: `${Math.max((count / max) * 100, 6)}%` }} />
      </div>
    </div>
  );
}

function Pager({ pagination, onPage, unit }: { pagination: Pagination; onPage: (updater: (page: number) => number) => void; unit: string }) {
  return (
    <div className="ds-pager">
      <span>
        {pagination.total} {unit} · trang {pagination.page}/{pagination.totalPages || 1}
      </span>
      <span style={{ display: "flex", gap: 8 }}>
        <DsButton disabled={pagination.page <= 1} onClick={() => onPage((current) => Math.max(current - 1, 1))}>
          Trước
        </DsButton>
        <DsButton disabled={pagination.page >= pagination.totalPages} onClick={() => onPage((current) => current + 1)}>
          Sau
        </DsButton>
      </span>
    </div>
  );
}

export default function ChatbotPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canView = can(user, "chatbot.view");
  const canAdmin = can(user, "chatbot.config");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [settingsActive, setSettingsActive] = useState(true);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(defaultSettings);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [logSearch, setLogSearch] = useState("");
  const [logIntent, setLogIntent] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const settingsFormInitializedRef = useRef(false);

  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const appliedSessionSearch = useDebouncedValue(sessionSearch.trim());
  const appliedLogSearch = useDebouncedValue(logSearch.trim());
  const appliedLogIntent = useDebouncedValue(logIntent.trim());

  const sessionQuery = useMemo(() => ({ search: appliedSessionSearch || undefined, isActive: sessionStatus || undefined, page: sessionPage, limit: 20 }), [appliedSessionSearch, sessionPage, sessionStatus]);
  const logQuery = useMemo(() => ({ search: appliedLogSearch || undefined, intent: appliedLogIntent || undefined, page: logPage, limit: 20 }), [appliedLogIntent, appliedLogSearch, logPage]);

  const overviewQuery = useDashboardChatbotOverview({}, canView && activeTab === "overview");
  const settingsQuery = useDashboardChatbotSettings(canView && activeTab === "settings");
  const sessionsQuery = useDashboardChatbotSessions(sessionQuery, canView && activeTab === "sessions");
  const logsQuery = useDashboardChatbotLogs(logQuery, canView && activeTab === "logs");
  const selectedSessionQuery = useDashboardChatbotSession(selectedSessionId);
  const overview = overviewQuery.data;
  const settings = settingsQuery.data;
  const sessions = sessionsQuery.data?.items ?? [];
  const sessionPagination = sessionsQuery.data?.pagination ?? emptyPagination;
  const selectedSession = selectedSessionQuery.data ?? null;
  const logs = logsQuery.data?.items ?? [];
  const logPagination = logsQuery.data?.pagination ?? emptyPagination;
  const activeQuery = activeTab === "overview" ? overviewQuery : activeTab === "settings" ? settingsQuery : activeTab === "sessions" ? sessionsQuery : logsQuery;
  const queryFailure = activeQuery.error || selectedSessionQuery.error;
  const queryError = queryFailure instanceof Error ? queryFailure.message : queryFailure ? "Không tải được dữ liệu trợ lý tư vấn" : "";

  useEffect(() => {
    if (!settingsQuery.data || settingsFormInitializedRef.current) return;
    const timeoutId = window.setTimeout(() => {
      settingsFormInitializedRef.current = true;
      setSettingsActive(settingsQuery.data.isActive);
      setSettingsForm(settingsQuery.data.value);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<ChatbotSettings>("/dashboard/chatbot/settings", { method: "PATCH", body: { isActive: settingsActive, ...settingsForm } });
      setSettingsActive(result.isActive);
      setSettingsForm(result.value);
      queryClient.setQueryData(queryKeys.dashboardChatbotSettings, result);
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboardChatbotSettings });
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicChatbotSettings });
      setNotice("Đã cập nhật cấu hình trợ lý tư vấn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được cấu hình trợ lý tư vấn");
    } finally {
      setSaving(false);
    }
  };

  const openSession = (item: { id: string }) => {
    setError("");
    setNotice("");
    setSelectedSessionId(item.id);
    setActiveTab("sessions");
  };

  const changeTab = (id: string) => {
    setActiveTab(id as TabKey);
    setSelectedSessionId(undefined);
  };

  if (!canView) {
    return (
      <>
        <DsPageHeader title="Trợ lý tư vấn" description="Phân hệ trợ lý tư vấn chỉ dành cho tài khoản được cấp quyền xem" />
        <DsNotice tone="info">Tài khoản của bạn chưa được cấp quyền xem trợ lý tư vấn.</DsNotice>
      </>
    );
  }

  const maxIntent = Math.max(...(overview?.intents.map((item) => item.count) || [1]), 1);
  const maxState = Math.max(...(overview?.states.map((item) => item.count) || [1]), 1);

  const sessionColumns: DsColumn<ChatbotSession>[] = [
    {
      key: "user",
      header: "Người dùng",
      cell: (row) => (
        <div>
          <strong>{row.guestPhone || row.user?.phone || "-"}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.user?.fullName || "Khách"}</div>
        </div>
      ),
    },
    {
      key: "intent",
      header: "Nhu cầu / trạng thái",
      cell: (row) => (
        <div>
          {row.currentIntent || "-"}
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.currentState || "-"}</div>
        </div>
      ),
    },
    {
      key: "last",
      header: "Tin gần nhất",
      cell: (row) => (
        <div>
          <div style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.lastMessage || "-"}</div>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{formatDateTime(row.updatedAt)}</div>
        </div>
      ),
    },
    { key: "count", header: "Tin nhắn", align: "num", cell: (row) => row._count.logs },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={row.isActive ? "good" : "neutral"}>{row.isActive ? "Đang mở" : "Đã đóng"}</DsStatusPill> },
  ];

  const overviewView = overview ? (
    <div style={{ display: "grid", gap: 16 }}>
      <section aria-label="Số liệu" className="ds-attn-grid">
        {[
          ["Tổng phiên", overview.metrics.totalSessions],
          ["Phiên đang hoạt động", overview.metrics.activeSessions],
          ["Tổng tin nhắn", overview.metrics.totalLogs],
        ].map(([label, value]) => (
          <div key={label} className="ds-attn">
            <span className="ds-attn__label">{label}</span>
            <strong className="ds-attn__value ds-num">{value}</strong>
          </div>
        ))}
      </section>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
        <DsPanel title="Nhóm nhu cầu phổ biến">
          <div style={{ display: "grid", gap: 12 }}>
            {overview.intents.length ? overview.intents.map((item) => <Bar key={item.intent || "none"} label={item.intent || "Không rõ"} count={item.count} max={maxIntent} color="var(--ds-accent)" />) : <p className="ds-hint" style={{ margin: 0 }}>Chưa ghi nhận nhóm nhu cầu.</p>}
          </div>
        </DsPanel>
        <DsPanel title="Trạng thái hội thoại">
          <div style={{ display: "grid", gap: 12 }}>
            {overview.states.length ? overview.states.map((item) => <Bar key={item.state || "none"} label={item.state || "Không rõ"} count={item.count} max={maxState} color="var(--ds-good)" />) : <p className="ds-hint" style={{ margin: 0 }}>Chưa ghi nhận trạng thái hội thoại.</p>}
          </div>
        </DsPanel>
      </div>
      <DsPanel title="Phiên mới cập nhật" flush>
        {overview.latestSessions.length === 0 ? <DsEmptyState title="Chưa có phiên nào" /> : null}
        {overview.latestSessions.map((item) => (
          <button key={item.id} type="button" className="ds-todo" style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, cursor: "pointer", color: "inherit" }} onClick={() => openSession(item)}>
            <div className="ds-todo__text">
              <strong>{displayParticipant(item)}</strong>
              <small>{item.lastMessage || "-"} · {formatDateTime(item.updatedAt)}</small>
            </div>
            <DsStatusPill tone={item.isActive ? "good" : "neutral"}>{item.isActive ? "Đang mở" : "Đã đóng"}</DsStatusPill>
          </button>
        ))}
      </DsPanel>
    </div>
  ) : null;

  const sessionList = (
    <DsPanel flush>
      <DsToolbar>
        <div style={{ minWidth: 180, flex: "1 1 240px" }}>
          <DsInput
            aria-label="Tìm phiên"
            value={sessionSearch}
            placeholder="Gõ số điện thoại, tin nhắn hoặc phản hồi để lọc"
            onChange={(event) => {
              setSessionSearch(event.target.value);
              setSessionPage(1);
            }}
          />
        </div>
        <div style={{ minWidth: 140, flex: "0 1 180px" }}>
          <DsSelect
            aria-label="Lọc phiên theo trạng thái"
            value={sessionStatus}
            onChange={(event) => {
              setSessionStatus(event.target.value);
              setSessionPage(1);
            }}
          >
            <option value="">Mọi trạng thái</option>
            <option value="true">Đang mở</option>
            <option value="false">Đã đóng</option>
          </DsSelect>
        </div>
      </DsToolbar>
      {selectedSessionId ? (
        sessions.length ? (
          <div role="listbox" aria-label="Danh sách phiên">
            {sessions.map((item) => (
              <button key={item.id} type="button" role="option" className="ds-listrow" aria-selected={item.id === selectedSessionId} onClick={() => openSession(item)}>
                <span className="ds-listrow__main">
                  <strong>{item.guestPhone || item.user?.phone || "Khách"}</strong>
                  <small>{item.lastMessage || "-"}</small>
                </span>
                <DsStatusPill tone={item.isActive ? "good" : "neutral"}>{item._count.logs} tin</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có phiên phù hợp" />
        )
      ) : (
        <DsDataTable caption="Danh sách phiên trợ lý tư vấn" columns={sessionColumns} rows={sessions} rowKey={(row) => row.id} loading={sessionsQuery.isLoading} emptyTitle="Chưa có phiên phù hợp" onRowClick={openSession} />
      )}
      <Pager pagination={sessionPagination} onPage={setSessionPage} unit="phiên" />
    </DsPanel>
  );

  const sessionPane = selectedSessionId ? (
    <DsPane
      title="Chi tiết phiên tư vấn"
      badge={selectedSession ? <DsStatusPill tone={selectedSession.isActive ? "good" : "neutral"}>{selectedSession.isActive ? "Đang mở" : "Đã đóng"}</DsStatusPill> : undefined}
      onClose={() => setSelectedSessionId(undefined)}
    >
      {selectedSession ? (
        <div style={{ display: "grid", gap: 12 }}>
          <DsKeyValue
            items={[
              { label: "Khách", value: displayParticipant(selectedSession) },
              { label: "Nhu cầu", value: selectedSession.currentIntent || "-" },
              { label: "Trạng thái", value: selectedSession.currentState || "-" },
              { label: "Cập nhật", value: formatDateTime(selectedSession.updatedAt) },
            ]}
          />
          <div>
            <strong style={{ fontSize: 13 }}>Nội dung tạm lưu</strong>
            <pre style={{ margin: "6px 0 0", maxHeight: 176, overflow: "auto", padding: 10, borderRadius: 6, background: "var(--ds-sunken)", fontSize: 12 }}>{summarizeJson(selectedSession.draft)}</pre>
          </div>
          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Trao đổi ({selectedSession.logs.length})</h3>
            </div>
            {selectedSession.logs.map((item) => (
              <div key={item.id} className="ds-labrow">
                <div className="ds-labrow__main">
                  <strong>{item.message}</strong>
                  <small>{item.response}</small>
                  <small>
                    {item.intent || "-"} · {formatDateTime(item.createdAt)}
                  </small>
                </div>
              </div>
            ))}
            {selectedSession.logs.length === 0 ? <p style={{ margin: 0, padding: 14, color: "var(--ds-muted)" }}>Chưa có trao đổi.</p> : null}
          </div>
        </div>
      ) : (
        <p className="ds-hint" style={{ margin: 0 }}>
          Đang tải chi tiết phiên...
        </p>
      )}
    </DsPane>
  ) : null;

  const logsView = (
    <DsPanel flush>
      <DsToolbar>
        <div style={{ minWidth: 180, flex: "1 1 240px" }}>
          <DsInput
            aria-label="Tìm nhật ký"
            value={logSearch}
            placeholder="Gõ tin nhắn, phản hồi hoặc số điện thoại để lọc"
            onChange={(event) => {
              setLogSearch(event.target.value);
              setLogPage(1);
            }}
          />
        </div>
        <div style={{ minWidth: 150, flex: "0 1 220px" }}>
          <DsInput
            aria-label="Lọc theo nhóm nhu cầu"
            value={logIntent}
            placeholder="Nhóm nhu cầu"
            onChange={(event) => {
              setLogIntent(event.target.value);
              setLogPage(1);
            }}
          />
        </div>
      </DsToolbar>
      {logs.length === 0 && !logsQuery.isLoading ? <DsEmptyState title="Chưa có nhật ký phù hợp" /> : null}
      {logs.map((item) => (
        <div key={item.id} className="ds-labrow">
          <div className="ds-labrow__main">
            <strong>{item.message}</strong>
            <small>{item.response}</small>
            <small>
              {displayParticipant(item)} · {item.intent || "Không rõ"} · {formatDateTime(item.createdAt)}
            </small>
          </div>
          {item.sessionId ? (
            <DsButton
              variant="ghost"
              onClick={() => {
                const sessionId = item.sessionId || "";
                setSessionSearch(sessionId);
                setSessionPage(1);
                setSelectedSessionId(undefined);
                setActiveTab("sessions");
              }}
            >
              Xem phiên
            </DsButton>
          ) : null}
        </div>
      ))}
      <Pager pagination={logPagination} onPage={setLogPage} unit="dòng" />
    </DsPanel>
  );

  const toggle = (checked: boolean, onChange: (next: boolean) => void, title: string, hint?: string) => (
    <label className="ds-check" style={{ cursor: canAdmin ? "pointer" : "default" }}>
      <input type="checkbox" checked={checked} disabled={!canAdmin} onChange={(event) => onChange(event.target.checked)} style={{ marginTop: 3 }} />
      <span>
        <strong>{title}</strong>
        {hint ? <small style={{ display: "block", color: "var(--ds-muted)" }}>{hint}</small> : null}
      </span>
    </label>
  );

  const settingsView = (
    <DsPanel title="Cấu hình vận hành">
      <form onSubmit={saveSettings} style={{ display: "grid", gap: 14, maxWidth: 720 }} aria-label="Cấu hình trợ lý tư vấn">
        <p className="ds-hint" style={{ margin: 0 }}>
          Nhân viên tiếp nhận được xem; chỉ quản trị viên được cập nhật cấu hình. Cập nhật lần cuối {formatDateTime(settings?.updatedAt)}.
        </p>
        {toggle(settingsActive, setSettingsActive, "Bật trợ lý tư vấn trên trang người dùng", "Tắt sẽ ẩn cửa sổ trò chuyện ở trang người dùng.")}
        {toggle(settingsForm.aiEnabled, (next) => setSettingsForm((current) => ({ ...current, aiEnabled: next })), "Bật trí tuệ nhân tạo")}
        {toggle(settingsForm.faqEnabled, (next) => setSettingsForm((current) => ({ ...current, faqEnabled: next })), "Bật câu hỏi thường gặp", "Câu hỏi thường gặp được quản lý tại Cấu hình website.")}
        {toggle(settingsForm.fallbackEnabled, (next) => setSettingsForm((current) => ({ ...current, fallbackEnabled: next })), "Dùng câu trả lời dự phòng khi có lỗi")}
        <div className="ds-grid-fields">
          <DsField label="Mô hình xử lý" htmlFor="cb-model">
            <DsInput id="cb-model" value={settingsForm.model} disabled={!canAdmin} onChange={(event) => setSettingsForm((current) => ({ ...current, model: event.target.value }))} />
          </DsField>
          <DsField label="Số hành động gợi ý" htmlFor="cb-actions" hint="1 đến 6">
            <DsInput id="cb-actions" type="number" min={1} max={6} value={settingsForm.maxSuggestedActions} disabled={!canAdmin} onChange={(event) => setSettingsForm((current) => ({ ...current, maxSuggestedActions: Number(event.target.value) }))} />
          </DsField>
          <DsField label="Ngày hết hạn phiên" htmlFor="cb-expire" hint="1 đến 30">
            <DsInput id="cb-expire" type="number" min={1} max={30} value={settingsForm.sessionExpiresDays} disabled={!canAdmin} onChange={(event) => setSettingsForm((current) => ({ ...current, sessionExpiresDays: Number(event.target.value) }))} />
          </DsField>
        </div>
        {canAdmin ? (
          <div>
            <DsButton type="submit" variant="primary" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu cấu hình"}
            </DsButton>
          </div>
        ) : null}
      </form>
    </DsPanel>
  );

  return (
    <>
      <DsPageHeader title="Trợ lý tư vấn" description="Theo dõi hội thoại và cấu hình trí tuệ nhân tạo. Câu hỏi thường gặp được quản lý chung tại Cấu hình website." />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {error || queryError ? <DsNotice tone="bad">{error || queryError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsPanel flush className="ds-tabs-host">
        <DsTabs label="Mục trợ lý tư vấn" items={tabs} value={activeTab} onChange={changeTab} />
      </DsPanel>
      <div style={{ marginTop: 16 }}>
        {activeTab === "overview" ? (overviewQuery.isLoading ? <p className="ds-hint">Đang tải dữ liệu trợ lý tư vấn...</p> : overviewView) : null}
        {activeTab === "sessions" ? <DsSplit list={sessionList} pane={sessionPane} /> : null}
        {activeTab === "logs" ? logsView : null}
        {activeTab === "settings" ? (settingsQuery.isLoading ? <p className="ds-hint">Đang tải cấu hình...</p> : settingsView) : null}
      </div>
    </>
  );
}
