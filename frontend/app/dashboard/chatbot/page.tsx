"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PanelRightOpen, Search } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import {
  DashboardPageHeader,
  DashboardStatusBadge,
  DashboardSurface,
  DashboardTableRegion,
} from "@/components/dashboard/dashboard-ui";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useDashboardChatbotFAQs,
  useDashboardChatbotLogs,
  useDashboardChatbotOverview,
  useDashboardChatbotSession,
  useDashboardChatbotSessions,
  useDashboardChatbotSettings,
} from "@/lib/dashboard-chatbot-query";
import { formatVietnamDateTime } from "@/lib/date";
import { queryKeys } from "@/lib/query-keys";
import type {
  ChatbotFAQ,
  ChatbotLog,
  ChatbotRuntimeValue,
  ChatbotSession,
  ChatbotSessionDetail,
  ChatbotSettings,
  Pagination,
} from "@/lib/types";

type TabKey = "overview" | "faqs" | "sessions" | "logs" | "settings";

type FAQForm = {
  question: string;
  answer: string;
  keywords: string;
  isActive: boolean;
};

type SettingsForm = ChatbotRuntimeValue;

const emptyFaqForm: FAQForm = {
  question: "",
  answer: "",
  keywords: "",
  isActive: true,
};

const emptyPagination: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

const defaultSettings: SettingsForm = {
  aiEnabled: true,
  fallbackEnabled: true,
  faqEnabled: true,
  model: "gemini-2.5-flash",
  maxSuggestedActions: 3,
  sessionExpiresDays: 7,
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Tổng quan" },
  { key: "faqs", label: "Câu hỏi thường gặp" },
  { key: "sessions", label: "Phiên" },
  { key: "logs", label: "Nhật ký" },
  { key: "settings", label: "Cấu hình" },
];

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "true", label: "Đang bật" },
  { value: "false", label: "Đang tắt" },
];

const formatDateTime = (value?: string | null) =>
  value ? formatVietnamDateTime(value) : "-";

const parseKeywords = (value: string) =>
  Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));

const toFaqForm = (item: ChatbotFAQ): FAQForm => ({
  question: item.question,
  answer: item.answer,
  keywords: item.keywords.join(", "),
  isActive: item.isActive,
});

const summarizeJson = (value: unknown) => {
  if (!value) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "-";
  }
};

const displayParticipant = (item: ChatbotSession | ChatbotSessionDetail | ChatbotLog) =>
  item.guestPhone || item.user?.phone || item.user?.fullName || "Khách";

export default function ChatbotPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canView = user?.role === "ADMIN" || user?.role === "STAFF";
  const canAdmin = user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [settingsActive, setSettingsActive] = useState(true);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(defaultSettings);
  const [faqSearch, setFaqSearch] = useState("");
  const [appliedFaqSearch, setAppliedFaqSearch] = useState("");
  const [faqStatus, setFaqStatus] = useState("");
  const [faqPage, setFaqPage] = useState(1);
  const [faqForm, setFaqForm] = useState<FAQForm>(emptyFaqForm);
  const [editingFaq, setEditingFaq] = useState<ChatbotFAQ | null>(null);
  const [deleteFaq, setDeleteFaq] = useState<ChatbotFAQ | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const [appliedSessionSearch, setAppliedSessionSearch] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [selectedSessionSnapshot, setSelectedSessionSnapshot] = useState<ChatbotSessionDetail | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [appliedLogSearch, setAppliedLogSearch] = useState("");
  const [logIntent, setLogIntent] = useState("");
  const [appliedLogIntent, setAppliedLogIntent] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [faqWorkspaceOpen, setFaqWorkspaceOpen] = useState(false);
  const [sessionWorkspaceOpen, setSessionWorkspaceOpen] = useState(false);
  const formRef = useRef<HTMLElement | null>(null);
  const faqListRef = useRef<HTMLElement | null>(null);
  const sessionDetailRef = useRef<HTMLElement | null>(null);
  const settingsFormInitializedRef = useRef(false);

  const faqQuery = useMemo(
    () => ({
      search: appliedFaqSearch || undefined,
      isActive: faqStatus || undefined,
      page: faqPage,
      limit: 20,
    }),
    [appliedFaqSearch, faqPage, faqStatus],
  );

  const sessionQuery = useMemo(
    () => ({
      search: appliedSessionSearch || undefined,
      isActive: sessionStatus || undefined,
      page: sessionPage,
      limit: 20,
    }),
    [appliedSessionSearch, sessionPage, sessionStatus],
  );

  const logQuery = useMemo(
    () => ({
      search: appliedLogSearch || undefined,
      intent: appliedLogIntent || undefined,
      page: logPage,
      limit: 20,
    }),
    [appliedLogIntent, appliedLogSearch, logPage],
  );

  const overviewQuery = useDashboardChatbotOverview({}, canView && activeTab === "overview");
  const settingsQuery = useDashboardChatbotSettings(canView && activeTab === "settings");
  const faqsQuery = useDashboardChatbotFAQs(faqQuery, canView && activeTab === "faqs");
  const sessionsQuery = useDashboardChatbotSessions(sessionQuery, canView && activeTab === "sessions");
  const logsQuery = useDashboardChatbotLogs(logQuery, canView && activeTab === "logs");
  const selectedSessionQuery = useDashboardChatbotSession(selectedSessionSnapshot?.id);
  const overview = overviewQuery.data;
  const settings = settingsQuery.data;
  const faqs = faqsQuery.data?.items ?? [];
  const faqPagination = faqsQuery.data?.pagination ?? emptyPagination;
  const sessions = sessionsQuery.data?.items ?? [];
  const sessionPagination = sessionsQuery.data?.pagination ?? emptyPagination;
  const selectedSession = selectedSessionQuery.data ?? selectedSessionSnapshot;
  const logs = logsQuery.data?.items ?? [];
  const logPagination = logsQuery.data?.pagination ?? emptyPagination;
  const activeQuery = activeTab === "overview"
    ? overviewQuery
    : activeTab === "settings"
      ? settingsQuery
      : activeTab === "faqs"
        ? faqsQuery
        : activeTab === "sessions"
          ? sessionsQuery
          : logsQuery;
  const loading = activeQuery.isLoading;
  const queryFailure = activeQuery.error || selectedSessionQuery.error;
  const queryError = queryFailure instanceof Error
    ? queryFailure.message
    : queryFailure
      ? "Không tải được dữ liệu trợ lý tư vấn"
      : "";

  const invalidateChatbotFAQs = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "chatbot", "faqs"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "chatbot", "overview"] }),
    ]);
  };

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

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    window.setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const startCreateFaq = () => {
    setFaqWorkspaceOpen(true);
    setEditingFaq(null);
    setDeleteFaq(null);
    setFaqForm(emptyFaqForm);
    setActiveTab("faqs");
    setError("");
    setNotice("");
    scrollTo(formRef);
  };

  const startEditFaq = (item: ChatbotFAQ) => {
    setFaqWorkspaceOpen(true);
    setEditingFaq(item);
    setDeleteFaq(null);
    setFaqForm(toFaqForm(item));
    setActiveTab("faqs");
    setError("");
    setNotice("");
    scrollTo(formRef);
  };

  const saveFaq = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canView) return;
    const keywords = parseKeywords(faqForm.keywords);
    if (keywords.length === 0) {
      setError("Cần nhập ít nhất một từ khóa cho câu hỏi");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        keywords,
        isActive: faqForm.isActive,
      };
      if (editingFaq) {
        await apiRequest<ChatbotFAQ>(`/dashboard/chatbot/faqs/${editingFaq.id}`, {
          method: "PATCH",
          body,
        });
        setNotice("Đã cập nhật câu hỏi thường gặp");
      } else {
        await apiRequest<ChatbotFAQ>("/dashboard/chatbot/faqs", {
          method: "POST",
          body,
        });
        setNotice("Đã tạo câu hỏi thường gặp");
      }
      setEditingFaq(null);
      setFaqForm(emptyFaqForm);
      await invalidateChatbotFAQs();
      scrollTo(faqListRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được câu hỏi thường gặp");
    } finally {
      setSaving(false);
    }
  };

  const toggleFaqStatus = async (item: ChatbotFAQ) => {
    if (!canView) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<ChatbotFAQ>(`/dashboard/chatbot/faqs/${item.id}/status`, {
        method: "PATCH",
        body: { isActive: !item.isActive },
      });
      setNotice(item.isActive ? "Đã tắt câu hỏi thường gặp" : "Đã bật câu hỏi thường gặp");
      await invalidateChatbotFAQs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái câu hỏi");
    }
  };

  const confirmDeleteFaq = async () => {
    if (!deleteFaq || !canAdmin) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<ChatbotFAQ>(`/dashboard/chatbot/faqs/${deleteFaq.id}`, {
        method: "DELETE",
      });
      setDeleteFaq(null);
      setNotice("Đã xoá câu hỏi thường gặp");
      await invalidateChatbotFAQs();
      scrollTo(faqListRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được câu hỏi thường gặp");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<ChatbotSettings>("/dashboard/chatbot/settings", {
        method: "PATCH",
        body: {
          isActive: settingsActive,
          ...settingsForm,
        },
      });
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

  const openSession = async (item: ChatbotSession) => {
    setSessionWorkspaceOpen(true);
    setError("");
    setNotice("");
    try {
      setSelectedSessionSnapshot({ ...item, logs: [] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboardChatbotSession(item.id) });
      setActiveTab("sessions");
      scrollTo(sessionDetailRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết phiên");
    }
  };

  if (!canView) {
    return (
      <DashboardPageHeader eyebrow="Tự động hóa" title="Trợ lý tư vấn" description="Phân hệ trợ lý tư vấn chỉ dành cho quản trị viên hoặc nhân viên tiếp nhận." />
    );
  }

  const maxIntent = Math.max(...(overview?.intents.map((item) => item.count) || [1]), 1);
  const maxState = Math.max(...(overview?.states.map((item) => item.count) || [1]), 1);

  return (
    <div className="space-y-6">
      <DashboardFeedback error={error || queryError} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />

      <DashboardPageHeader
        eyebrow="Tự động hóa"
        title="Trợ lý tư vấn"
        description="Theo dõi hội thoại, cấu hình trí tuệ nhân tạo và quản lý bộ câu hỏi thường gặp."
        actions={<><button onClick={startCreateFaq} className="min-h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:opacity-90">Tạo câu hỏi</button>{activeTab === "faqs" && !faqWorkspaceOpen && (editingFaq || deleteFaq) ? <button onClick={() => setFaqWorkspaceOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold"><PanelRightOpen className="h-4 w-4" />Mở lại biểu mẫu</button> : null}</>}
      />
      <DashboardSurface className="p-4">
        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${activeTab === item.key ? "border-[#0d4f8b] bg-[#e7f0fb] text-[#0d4f8b]" : "border-[#dce3ee] text-[#42526b] hover:bg-[#f8fafc]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </DashboardSurface>

      {loading ? (
        <section className="rounded-md border border-[#dce3ee] bg-white p-8 text-center text-sm text-[#667892]">Đang tải dữ liệu trợ lý tư vấn...</section>
      ) : null}

      {activeTab === "overview" && overview ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-[#dce3ee] bg-white p-5"><p className="text-sm text-[#667892]">Tổng phiên</p><p className="mt-2 text-3xl font-semibold">{overview.metrics.totalSessions}</p></div>
            <div className="rounded-md border border-[#dce3ee] bg-white p-5"><p className="text-sm text-[#667892]">Phiên đang hoạt động</p><p className="mt-2 text-3xl font-semibold">{overview.metrics.activeSessions}</p></div>
            <div className="rounded-md border border-[#dce3ee] bg-white p-5"><p className="text-sm text-[#667892]">Tổng tin nhắn</p><p className="mt-2 text-3xl font-semibold">{overview.metrics.totalLogs}</p></div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-md border border-[#dce3ee] bg-white p-5">
              <h3 className="font-semibold">Nhóm nhu cầu phổ biến</h3>
              <div className="mt-4 space-y-3">
                {overview.intents.length ? overview.intents.map((item) => (
                  <div key={item.intent || "none"}>
                    <div className="flex justify-between text-sm"><span>{item.intent || "Không rõ"}</span><span>{item.count}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-[#eef2f7]"><div className="h-2 rounded-full bg-[#0d4f8b]" style={{ width: `${Math.max((item.count / maxIntent) * 100, 6)}%` }} /></div>
                  </div>
                )) : <p className="text-sm text-[#667892]">Chưa ghi nhận nhóm nhu cầu.</p>}
              </div>
            </div>
            <div className="rounded-md border border-[#dce3ee] bg-white p-5">
              <h3 className="font-semibold">Trạng thái hội thoại</h3>
              <div className="mt-4 space-y-3">
                {overview.states.length ? overview.states.map((item) => (
                  <div key={item.state || "none"}>
                    <div className="flex justify-between text-sm"><span>{item.state || "Không rõ"}</span><span>{item.count}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-[#eef2f7]"><div className="h-2 rounded-full bg-[#2a7f62]" style={{ width: `${Math.max((item.count / maxState) * 100, 6)}%` }} /></div>
                  </div>
                )) : <p className="text-sm text-[#667892]">Chưa ghi nhận trạng thái hội thoại.</p>}
              </div>
            </div>
          </section>

          <section className="rounded-md border border-[#dce3ee] bg-white p-5">
            <h3 className="font-semibold">Phiên mới cập nhật</h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {overview.latestSessions.map((item) => (
                <button key={item.id} onClick={() => void openSession(item)} className="rounded-md border border-[#e5ebf3] p-4 text-left hover:border-[#0d4f8b]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{displayParticipant(item)}</p>
                     <DashboardStatusBadge tone={item.isActive ? "positive" : "neutral"}>{item.isActive ? "Đang mở" : "Đã đóng"}</DashboardStatusBadge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-[#667892]">{item.lastMessage || "-"}</p>
                  <p className="mt-2 text-xs text-[#8a98aa]">{formatDateTime(item.updatedAt)}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "faqs" ? (
        <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${faqWorkspaceOpen ? "xl:grid-cols-[minmax(0,1fr)_410px]" : "xl:grid-cols-1"}`}>
          <section ref={faqListRef} className="min-w-0 scroll-mt-24 rounded-md border border-[#dce3ee] bg-white">
            <form onSubmit={(event) => { event.preventDefault(); setAppliedFaqSearch(faqSearch.trim()); setFaqPage(1); }} className="grid gap-3 border-b border-[#e5ebf3] p-4 md:grid-cols-[1fr_180px_auto]">
              <input value={faqSearch} onChange={(event) => setFaqSearch(event.target.value)} placeholder="Tìm câu hỏi, câu trả lời, từ khoá" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
              <select value={faqStatus} onChange={(event) => { setFaqStatus(event.target.value); setFaqPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold"><Search className="h-4 w-4" />Tìm</button>
            </form>
            <div className="divide-y divide-[#eef2f7]">
              {faqs.length ? faqs.map((item) => (
                <article key={item.id} className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{item.question}</h3>
                        <DashboardStatusBadge tone={item.isActive ? "positive" : "neutral"}>{item.isActive ? "Đang bật" : "Đang tắt"}</DashboardStatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-[#667892]">{item.answer}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-[#f1f5f9] px-2 py-1 text-xs font-medium text-[#42526b]">{keyword}</span>)}
                      </div>
                      <p className="mt-3 text-xs text-[#8a98aa]">Cập nhật {formatDateTime(item.updatedAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button onClick={() => startEditFaq(item)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Sửa</button>
                      <button onClick={() => void toggleFaqStatus(item)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">{item.isActive ? "Tắt" : "Bật"}</button>
                      {canAdmin ? <button onClick={() => { setDeleteFaq(item); setFaqWorkspaceOpen(true); scrollTo(formRef); }} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e]">Xoá</button> : null}
                    </div>
                  </div>
                </article>
              )) : <p className="p-8 text-center text-sm text-[#667892]">Chưa có câu hỏi thường gặp phù hợp.</p>}
            </div>
            <div className="flex items-center justify-between border-t border-[#e5ebf3] px-4 py-3 text-sm text-[#667892]">
              <span>{faqPagination.total} kết quả, trang {faqPagination.page}/{faqPagination.totalPages || 1}</span>
              <div className="flex gap-2">
                <button disabled={faqPage <= 1} onClick={() => setFaqPage((current) => Math.max(current - 1, 1))} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Trước</button>
                <button disabled={faqPage >= faqPagination.totalPages} onClick={() => setFaqPage((current) => current + 1)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Sau</button>
              </div>
            </div>
          </section>

          {faqWorkspaceOpen ? (
          <aside ref={formRef} className="min-w-0 scroll-mt-24">
            <DashboardWorkspace
              open={faqWorkspaceOpen}
              onOpenChange={setFaqWorkspaceOpen}
              title={editingFaq ? "Cập nhật câu hỏi" : "Công cụ câu hỏi thường gặp"}
              description="Quản lý câu trả lời mẫu và từ khóa giúp trợ lý phản hồi chính xác hơn."
            >
            {deleteFaq ? (
              <div className="mb-5 rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4">
                <h3 className="font-semibold text-[#b3261e]">Xác nhận xoá câu hỏi</h3>
                <p className="mt-2 text-sm text-[#5f2630]">{deleteFaq.question}</p>
                <div className="mt-3 flex gap-2">
                  <button disabled={saving} onClick={() => void confirmDeleteFaq()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xoá</button>
                  <button onClick={() => setDeleteFaq(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Huỷ</button>
                </div>
              </div>
            ) : null}
            <h3 className="text-lg font-semibold">{editingFaq ? "Cập nhật câu hỏi" : "Tạo câu hỏi thường gặp"}</h3>
            <form className="mt-5 space-y-4" onSubmit={saveFaq}>
              <label className="block"><span className="text-sm font-medium text-[#334155]">Câu hỏi</span><textarea value={faqForm.question} onChange={(event) => setFaqForm((current) => ({ ...current, question: event.target.value }))} rows={3} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required /></label>
              <label className="block"><span className="text-sm font-medium text-[#334155]">Câu trả lời</span><textarea value={faqForm.answer} onChange={(event) => setFaqForm((current) => ({ ...current, answer: event.target.value }))} rows={5} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required /></label>
              <label className="block"><span className="text-sm font-medium text-[#334155]">Từ khoá</span><input value={faqForm.keywords} onChange={(event) => setFaqForm((current) => ({ ...current, keywords: event.target.value }))} placeholder="đặt lịch, khám, bác sĩ" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required /><span className="mt-1 block text-xs text-[#667892]">Phân tách bằng dấu phẩy, tối đa 20 từ khoá.</span></label>
              <label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2"><span className="text-sm font-medium text-[#334155]">Đang bật</span><input type="checkbox" checked={faqForm.isActive} onChange={(event) => setFaqForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 accent-[#0d4f8b]" /></label>
              <div className="flex gap-2">
                <button disabled={saving} className="flex-1 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{saving ? "Đang lưu..." : editingFaq ? "Lưu thay đổi" : "Tạo câu hỏi"}</button>
                {editingFaq ? <button type="button" onClick={startCreateFaq} className="rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-medium text-[#42526b]">Huỷ</button> : null}
              </div>
            </form>
            </DashboardWorkspace>
          </aside>
          ) : null}
        </div>
      ) : null}

      {activeTab === "sessions" ? (
        <div className={`grid gap-6 transition-[grid-template-columns] duration-300 ${sessionWorkspaceOpen ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "xl:grid-cols-1"}`}>
          <section className="min-w-0 rounded-md border border-[#dce3ee] bg-white">
            <form onSubmit={(event) => { event.preventDefault(); setAppliedSessionSearch(sessionSearch.trim()); setSessionPage(1); }} className="grid gap-3 border-b border-[#e5ebf3] p-4 md:grid-cols-[1fr_180px_auto]">
              <input value={sessionSearch} onChange={(event) => setSessionSearch(event.target.value)} placeholder="Tìm số điện thoại, tin nhắn, phản hồi" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
              <select value={sessionStatus} onChange={(event) => { setSessionStatus(event.target.value); setSessionPage(1); }} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]">
                {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold"><Search className="h-4 w-4" />Tìm</button>
            </form>
            <DashboardTableRegion label="Danh sách phiên trợ lý tư vấn">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
                <thead><tr className="text-[#667892]"><th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Người dùng</th><th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Nhu cầu / trạng thái</th><th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Tin gần nhất</th><th className="border-b border-[#e5ebf3] px-4 py-3 font-semibold">Nhật ký</th><th className="border-b border-[#e5ebf3] px-4 py-3 text-right font-semibold">Thao tác</th></tr></thead>
                <tbody>
                  {sessions.length ? sessions.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="border-b border-[#eef2f7] px-4 py-3"><p className="font-semibold">{item.guestPhone || item.user?.phone || "-"}</p><p className="mt-1 text-xs text-[#667892]">{item.user?.fullName || item.id}</p></td>
                      <td className="border-b border-[#eef2f7] px-4 py-3"><p>{item.currentIntent || "-"}</p><p className="mt-1 text-xs text-[#667892]">{item.currentState || "-"}</p></td>
                      <td className="border-b border-[#eef2f7] px-4 py-3"><p className="line-clamp-2">{item.lastMessage || "-"}</p><p className="mt-1 text-xs text-[#667892]">{formatDateTime(item.updatedAt)}</p></td>
                      <td className="border-b border-[#eef2f7] px-4 py-3">{item._count.logs}</td>
                      <td className="border-b border-[#eef2f7] px-4 py-3 text-right"><button onClick={() => void openSession(item)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Chi tiết</button></td>
                    </tr>
                  )) : <tr><td colSpan={5} className="px-4 py-10 text-center text-[#667892]">Chưa có phiên phù hợp</td></tr>}
                </tbody>
              </table>
            </DashboardTableRegion>
            <div className="flex items-center justify-between border-t border-[#e5ebf3] px-4 py-3 text-sm text-[#667892]">
              <span>{sessionPagination.total} kết quả, trang {sessionPagination.page}/{sessionPagination.totalPages || 1}</span>
              <div className="flex gap-2">
                <button disabled={sessionPage <= 1} onClick={() => setSessionPage((current) => Math.max(current - 1, 1))} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Trước</button>
                <button disabled={sessionPage >= sessionPagination.totalPages} onClick={() => setSessionPage((current) => current + 1)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Sau</button>
              </div>
            </div>
          </section>
          {sessionWorkspaceOpen ? (
          <aside ref={sessionDetailRef} className="min-w-0 scroll-mt-24">
            <DashboardWorkspace open={sessionWorkspaceOpen} onOpenChange={setSessionWorkspaceOpen} title="Chi tiết phiên tư vấn" description="Theo dõi trạng thái, nội dung tạm lưu và lịch sử trao đổi.">
            <h3 className="text-lg font-semibold">Chi tiết phiên</h3>
            {selectedSession ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border border-[#e5ebf3] p-3 text-sm"><p><span className="font-medium">Khách:</span> {displayParticipant(selectedSession)}</p><p className="mt-1"><span className="font-medium">Trạng thái:</span> {selectedSession.currentState || "-"}</p><p className="mt-1"><span className="font-medium">Hết hạn:</span> {formatDateTime(selectedSession.expiresAt)}</p></div>
                <div><p className="text-sm font-semibold">Nội dung tạm lưu</p><pre className="mt-2 max-h-44 overflow-auto rounded-md bg-[#f8fafc] p-3 text-xs text-[#42526b]">{summarizeJson(selectedSession.draft)}</pre></div>
                <div className="space-y-3">
                  {selectedSession.logs.map((item) => (
                    <div key={item.id} className="rounded-md border border-[#e5ebf3] p-3 text-sm">
                      <p className="font-medium">{item.message}</p>
                      <p className="mt-2 text-[#667892]">{item.response}</p>
                      <p className="mt-2 text-xs text-[#8a98aa]">{item.intent || "-"} - {formatDateTime(item.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="mt-3 text-sm text-[#667892]">Chọn một phiên để xem nhật ký và nội dung tạm lưu.</p>}
            </DashboardWorkspace>
          </aside>
          ) : null}
        </div>
      ) : null}

      {activeTab === "logs" ? (
        <section className="rounded-md border border-[#dce3ee] bg-white">
          <form onSubmit={(event) => { event.preventDefault(); setAppliedLogSearch(logSearch.trim()); setAppliedLogIntent(logIntent.trim()); setLogPage(1); }} className="grid gap-3 border-b border-[#e5ebf3] p-4 md:grid-cols-[1fr_220px_auto]">
            <input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} placeholder="Tìm tin nhắn, phản hồi, số điện thoại" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
            <input value={logIntent} onChange={(event) => setLogIntent(event.target.value)} placeholder="Lọc theo nhóm nhu cầu" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold"><Search className="h-4 w-4" />Tìm</button>
          </form>
          <div className="divide-y divide-[#eef2f7]">
            {logs.length ? logs.map((item) => (
              <article key={item.id} className="p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{displayParticipant(item)}</p>
                    <p className="mt-1 text-xs text-[#667892]">{item.intent || "Không rõ"} - {formatDateTime(item.createdAt)}</p>
                  </div>
                  <button onClick={() => { const sessionId = item.sessionId || ""; setSessionSearch(sessionId); setAppliedSessionSearch(sessionId); setSessionPage(1); setActiveTab("sessions"); }} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Tìm phiên</button>
                </div>
                <p className="mt-3 text-sm font-medium">{item.message}</p>
                <p className="mt-2 text-sm text-[#667892]">{item.response}</p>
              </article>
            )) : <p className="p-8 text-center text-sm text-[#667892]">Chưa có log phù hợp.</p>}
          </div>
          <div className="flex items-center justify-between border-t border-[#e5ebf3] px-4 py-3 text-sm text-[#667892]">
            <span>{logPagination.total} kết quả, trang {logPagination.page}/{logPagination.totalPages || 1}</span>
            <div className="flex gap-2">
              <button disabled={logPage <= 1} onClick={() => setLogPage((current) => Math.max(current - 1, 1))} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Trước</button>
              <button disabled={logPage >= logPagination.totalPages} onClick={() => setLogPage((current) => current + 1)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 font-medium disabled:opacity-50">Sau</button>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "settings" ? (
        <section className="rounded-md border border-[#dce3ee] bg-white p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Cấu hình vận hành</h3>
              <p className="mt-1 text-sm text-[#667892]">Nhân viên tiếp nhận được xem; chỉ quản trị viên được cập nhật cấu hình.</p>
            </div>
            <p className="text-xs text-[#8a98aa]">Cập nhật {formatDateTime(settings?.updatedAt)}</p>
          </div>
          <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={saveSettings}>
            <label className="flex items-center justify-between rounded-md border border-[#cfe0f3] bg-[#f8fbff] px-3 py-2 lg:col-span-2">
              <span>
                <span className="block text-sm font-semibold text-[#172033]">Bật trợ lý tư vấn trên trang người dùng</span>
                <span className="mt-1 block text-xs text-[#667892]">Tắt công tắc này sẽ ẩn cửa sổ trò chuyện ở trang người dùng.</span>
              </span>
              <input disabled={!canAdmin} type="checkbox" checked={settingsActive} onChange={(event) => setSettingsActive(event.target.checked)} className="h-4 w-4 accent-[#0d4f8b] disabled:opacity-60" />
            </label>
            <label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2"><span className="text-sm font-medium text-[#334155]">Bật trí tuệ nhân tạo</span><input disabled={!canAdmin} type="checkbox" checked={settingsForm.aiEnabled} onChange={(event) => setSettingsForm((current) => ({ ...current, aiEnabled: event.target.checked }))} className="h-4 w-4 accent-[#0d4f8b] disabled:opacity-60" /></label>
            <label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2"><span className="text-sm font-medium text-[#334155]">Bật câu hỏi thường gặp</span><input disabled={!canAdmin} type="checkbox" checked={settingsForm.faqEnabled} onChange={(event) => setSettingsForm((current) => ({ ...current, faqEnabled: event.target.checked }))} className="h-4 w-4 accent-[#0d4f8b] disabled:opacity-60" /></label>
            <label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2"><span className="text-sm font-medium text-[#334155]">Dùng câu trả lời dự phòng khi có lỗi</span><input disabled={!canAdmin} type="checkbox" checked={settingsForm.fallbackEnabled} onChange={(event) => setSettingsForm((current) => ({ ...current, fallbackEnabled: event.target.checked }))} className="h-4 w-4 accent-[#0d4f8b] disabled:opacity-60" /></label>
            <label className="block"><span className="text-sm font-medium text-[#334155]">Mô hình xử lý</span><input disabled={!canAdmin} value={settingsForm.model} onChange={(event) => setSettingsForm((current) => ({ ...current, model: event.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" required /></label>
            <label className="block"><span className="text-sm font-medium text-[#334155]">Số hành động gợi ý</span><input disabled={!canAdmin} type="number" min={1} max={6} value={settingsForm.maxSuggestedActions} onChange={(event) => setSettingsForm((current) => ({ ...current, maxSuggestedActions: Number(event.target.value) }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
            <label className="block"><span className="text-sm font-medium text-[#334155]">Ngày hết hạn phiên</span><input disabled={!canAdmin} type="number" min={1} max={30} value={settingsForm.sessionExpiresDays} onChange={(event) => setSettingsForm((current) => ({ ...current, sessionExpiresDays: Number(event.target.value) }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
            {canAdmin ? <div className="lg:col-span-2"><button disabled={saving} className="rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu cấu hình"}</button></div> : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
