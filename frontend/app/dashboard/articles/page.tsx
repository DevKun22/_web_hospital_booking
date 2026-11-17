"use client";

import { FormEvent, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsDialog,
  DsEmptyState,
  DsField,
  DsInput,
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
  useActionToast,
  useConfirm,
} from "@/components/ds";
import { ArticleContent } from "@/components/public/article-content";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardDepartments } from "@/lib/dashboard-departments-query";
import { parseMarkdown, slugifyHeading } from "@/lib/markdown";
import { can } from "@/lib/permissions";
import type { Article, ArticleSummary, ListResult } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Bài viết kiến thức sức khỏe: người viết (quản trị, nhân viên, bác sĩ) lưu bản nháp; chỉ quản trị xuất bản và phải ghi người duyệt
// nội dung chuyên môn. Bài đã xuất bản hiện ở /kien-thuc và là nguồn tri thức của chatbot.

type ArticleForm = { title: string; slug: string; summary: string; category: string; departmentId: string; content: string };

const emptyForm: ArticleForm = { title: "", slug: "", summary: "", category: "", departmentId: "", content: "" };

const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "DRAFT", label: "Bản nháp" },
  { id: "PUBLISHED", label: "Đã xuất bản" },
];

const toForm = (article: Article): ArticleForm => ({
  title: article.title,
  slug: article.slug,
  summary: article.summary || "",
  category: article.category || "",
  departmentId: article.departmentId || "",
  content: article.content,
});

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "-");

type PaneState = { kind: "new" } | { kind: "edit"; id: string } | null;

export default function ArticlesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pane, setPane] = useState<PaneState>(null);
  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [reviewer, setReviewer] = useState("");

  const canWrite = can(user, "article.write");
  const canPublish = can(user, "article.publish");

  const term = useDebouncedValue(search.trim());
  const query = useMemo(() => ({ q: term || undefined, status: status || undefined, page, limit: 10 }), [page, status, term]);
  const listQuery = useQuery({
    queryKey: ["dashboard", "articles", query],
    queryFn: () => apiRequest<ListResult<ArticleSummary>>("/dashboard/articles", { query }),
    placeholderData: keepPreviousData,
    enabled: canWrite,
  });
  const articles = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination ?? { page, limit: 10, total: 0, totalPages: 1 };
  const editingId = pane?.kind === "edit" ? pane.id : null;
  const detailQuery = useQuery({
    queryKey: ["dashboard", "articles", "detail", editingId],
    queryFn: () => apiRequest<Article>(`/dashboard/articles/${editingId}`),
    enabled: Boolean(editingId),
  });
  const editing = detailQuery.data && detailQuery.data.id === editingId ? detailQuery.data : null;
  const departmentsQuery = useDashboardDepartments({ limit: 100 });
  const departments = departmentsQuery.data?.items ?? [];
  const queryErrorMessage = listQuery.error instanceof Error ? listQuery.error.message : "";

  useActionToast({ notice, error, clear: () => { setNotice(""); setError(""); } });

  // Bài đã xuất bản đang hiển thị cho người khám và chatbot: chỉ người có quyền xuất bản sửa được.
  const locked = editing?.status === "PUBLISHED" && !canPublish;

  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["dashboard", "articles"] }), queryClient.invalidateQueries({ queryKey: ["dashboard", "chatbot"] })]);
  };

  const startCreate = () => {
    setForm(emptyForm);
    setSlugTouched(false);
    setPreview(false);
    setError("");
    setPane({ kind: "new" });
  };

  const startEdit = (article: ArticleSummary) => {
    setSlugTouched(true);
    setPreview(false);
    setError("");
    setForm(emptyForm);
    setPane({ kind: "edit", id: article.id });
  };

  // Biểu mẫu nhận dữ liệu bài khi tải xong (một lần cho mỗi bài mở ra).
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (editing && loadedId !== editing.id) {
    setLoadedId(editing.id);
    setForm(toForm(editing));
  }

  const closePane = () => {
    setPane(null);
    setLoadedId(null);
  };

  const payload = () => ({
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    summary: form.summary.trim() || null,
    category: form.category.trim() || null,
    departmentId: form.departmentId || null,
    content: form.content,
  });

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || locked) return;
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await apiRequest<Article>(`/dashboard/articles/${editing.id}`, { method: "PATCH", body: payload() });
        setNotice("Đã lưu bài viết");
      } else {
        const created = await apiRequest<Article>("/dashboard/articles", { method: "POST", body: payload() });
        setNotice("Đã lưu bản nháp");
        setLoadedId(created.id);
        setPane({ kind: "edit", id: created.id });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được bài viết");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest<Article>(`/dashboard/articles/${editing.id}/publish`, { method: "POST", body: { reviewerName: reviewer.trim() } });
      setNotice("Đã xuất bản. Chatbot sẽ dùng bài này ngay sau khi kho tri thức cập nhật.");
      setPublishOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xuất bản được bài viết");
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest<Article>(`/dashboard/articles/${editing.id}/unpublish`, { method: "POST" });
      setNotice("Đã gỡ bài khỏi website và chatbot");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gỡ được bài viết");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!(await confirm({ title: "Xóa bài viết?", message: `Bài "${editing.title}" sẽ bị xóa vĩnh viễn và không còn trong tri thức của chatbot.`, confirmLabel: "Xóa", tone: "danger" }))) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/dashboard/articles/${editing.id}`, { method: "DELETE" });
      setNotice("Đã xóa bài viết");
      closePane();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được bài viết");
    } finally {
      setSaving(false);
    }
  };

  const columns: DsColumn<ArticleSummary>[] = [
    {
      key: "title",
      header: "Bài viết",
      cell: (row) => (
        <div>
          <strong>{row.title}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{[row.category, row.department?.name].filter(Boolean).join(" · ") || "Chưa phân loại"}</div>
        </div>
      ),
    },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={row.status === "PUBLISHED" ? "good" : "warn"}>{row.status === "PUBLISHED" ? "Đã xuất bản" : "Bản nháp"}</DsStatusPill> },
    { key: "reviewer", header: "Người duyệt", cell: (row) => row.reviewerName || "-" },
    { key: "updated", header: "Cập nhật", cell: (row) => formatDate(row.updatedAt) },
  ];

  const list = (
    <DsPanel flush>
      <form onSubmit={(event) => event.preventDefault()} aria-label="Lọc bài viết">
        <DsToolbar>
          <div style={{ minWidth: 180, flex: "1 1 240px" }}>
            <DsInput aria-label="Tìm bài viết" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Gõ tiêu đề để lọc" />
          </div>
          <DsButton variant="primary" onClick={startCreate}>
            <Plus aria-hidden="true" />
            Viết bài mới
          </DsButton>
        </DsToolbar>
      </form>
      <DsTabs label="Lọc bài viết theo trạng thái" items={statusTabs} value={status} onChange={(id) => { setStatus(id); setPage(1); }} />
      {pane ? (
        articles.length ? (
          <div role="listbox" aria-label="Danh sách bài viết">
            {articles.map((article) => (
              <button key={article.id} type="button" role="option" className="ds-listrow" aria-selected={editingId === article.id} onClick={() => startEdit(article)}>
                <span className="ds-listrow__main">
                  <strong>{article.title}</strong>
                  <small>{article.category || "Chưa phân loại"}</small>
                </span>
                <DsStatusPill tone={article.status === "PUBLISHED" ? "good" : "warn"}>{article.status === "PUBLISHED" ? "Đã xuất bản" : "Nháp"}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có bài viết phù hợp" />
        )
      ) : (
        <DsDataTable
          caption="Danh sách bài viết"
          columns={columns}
          rows={articles}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading}
          emptyTitle="Chưa có bài viết"
          emptyDescription="Bấm Viết bài mới để soạn bản nháp đầu tiên."
          onRowClick={startEdit}
        />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} bài · trang {pagination.page}/{pagination.totalPages || 1}
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

  const blocks = preview ? parseMarkdown(form.content) : [];
  const paneNode = pane ? (
    <DsPane
      wide
      title={editing ? editing.title : "Viết bài mới"}
      badge={editing ? <DsStatusPill tone={editing.status === "PUBLISHED" ? "good" : "warn"}>{editing.status === "PUBLISHED" ? "Đã xuất bản" : "Bản nháp"}</DsStatusPill> : undefined}
      onClose={closePane}
    >
      <form onSubmit={handleSave} style={{ display: "grid", gap: 12 }} aria-label="Soạn bài viết">
        {locked ? <DsNotice tone="warn">Bài đã xuất bản nên chỉ quản trị sửa được. Bạn có thể soạn bản nháp mới thay thế.</DsNotice> : null}
        {editing?.status === "PUBLISHED" && editing.reviewerName ? (
          <DsNotice tone="good">
            Đã được {editing.reviewerName} duyệt ngày {formatDate(editing.reviewedAt)}. Sửa nội dung xong nên được người duyệt xem lại.
          </DsNotice>
        ) : null}
        <DsField label="Tiêu đề" htmlFor="art-title" required>
          <DsInput
            id="art-title"
            value={form.title}
            required
            disabled={locked}
            onChange={(event) => {
              const title = event.target.value;
              setForm((current) => ({ ...current, title, slug: slugTouched ? current.slug : slugifyHeading(title) }));
            }}
          />
        </DsField>
        <DsField label="Đường dẫn" htmlFor="art-slug" hint="Tự sinh từ tiêu đề, dùng trong địa chỉ trang và liên kết nguồn của chatbot">
          <DsInput id="art-slug" value={form.slug} disabled={locked} onChange={(event) => { setSlugTouched(true); setForm((current) => ({ ...current, slug: slugifyHeading(event.target.value) })); }} />
        </DsField>
        <DsField label="Tóm tắt" htmlFor="art-summary" hint="Hiện ở danh sách bài và kết quả tìm kiếm">
          <DsTextarea id="art-summary" rows={2} maxLength={400} value={form.summary} disabled={locked} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} />
        </DsField>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <DsField label="Danh mục" htmlFor="art-category">
            <DsInput id="art-category" value={form.category} placeholder="Dinh dưỡng, Phòng bệnh..." disabled={locked} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
          </DsField>
          <DsField label="Chuyên khoa liên quan" htmlFor="art-dept" hint="Cuối bài có nút đặt lịch khoa này">
            <DsSelect id="art-dept" value={form.departmentId} disabled={locked} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}>
              <option value="">Không gắn chuyên khoa</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </DsSelect>
          </DsField>
        </div>
        <DsField label="Nội dung" htmlFor="art-content" required hint="Viết bằng Markdown: ## Tiêu đề mục, - danh sách, **đậm**, [chữ](đường dẫn). Mỗi mục ## là một đoạn tri thức của chatbot.">
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <DsButton onClick={() => setPreview(false)} variant={preview ? "ghost" : "default"}>
              Soạn
            </DsButton>
            <DsButton onClick={() => setPreview(true)} variant={preview ? "default" : "ghost"}>
              Xem trước
            </DsButton>
          </div>
          {preview ? (
            <div className="ds-card" style={{ padding: 16, maxHeight: 420, overflow: "auto" }}>
              {blocks.length ? <ArticleContent blocks={blocks} /> : <p className="ds-hint">Chưa có nội dung để xem trước.</p>}
            </div>
          ) : (
            <DsTextarea id="art-content" rows={16} value={form.content} required disabled={locked} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
          )}
        </DsField>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {editing?.status === "PUBLISHED" ? (
              <a className="ds-btn ds-btn--ghost" href={`/kien-thuc/${editing.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Xem trên website
              </a>
            ) : null}
            {editing && canPublish ? (
              editing.status === "PUBLISHED" ? (
                <DsButton disabled={saving} onClick={() => void handleUnpublish()}>
                  Gỡ xuất bản
                </DsButton>
              ) : (
                <DsButton disabled={saving} onClick={() => { setReviewer(editing.reviewerName || ""); setPublishOpen(true); }}>
                  Xuất bản
                </DsButton>
              )
            ) : null}
            {editing && canPublish ? (
              <DsButton variant="ghost" disabled={saving} onClick={() => void handleDelete()}>
                Xóa bài
              </DsButton>
            ) : null}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <DsButton onClick={closePane}>Đóng</DsButton>
            <DsButton type="submit" variant="primary" loading={saving} disabled={locked || !form.title.trim() || !form.content.trim()}>
              {editing ? "Lưu thay đổi" : "Lưu bản nháp"}
            </DsButton>
          </span>
        </div>
        {editing && !canPublish && editing.status === "DRAFT" ? <p className="ds-hint">Bản nháp cần quản trị duyệt và xuất bản trước khi hiện trên website.</p> : null}
      </form>
    </DsPane>
  ) : null;

  const unsavedChanges = editing ? JSON.stringify(toForm(editing)) !== JSON.stringify(form) : false;

  return (
    <>
      <DsPageHeader title="Kiến thức sức khỏe" description="Bài viết cho trang Kiến thức; bài đã xuất bản cũng là nguồn tri thức của chatbot Kun" />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>{queryErrorMessage ? <DsNotice tone="bad">{queryErrorMessage}</DsNotice> : null}</div>
      <DsSplit wide list={list} pane={paneNode} />
      <DsDialog
        open={publishOpen}
        onOpenChange={(open) => !open && setPublishOpen(false)}
        title="Xuất bản bài viết"
        description="Bài sẽ hiện công khai ở trang Kiến thức và trở thành nguồn trả lời của chatbot. Ghi rõ người đã duyệt nội dung chuyên môn."
        size="md"
        footer={
          <>
            <DsButton onClick={() => setPublishOpen(false)}>Chưa xuất bản</DsButton>
            <DsButton variant="primary" loading={saving} disabled={reviewer.trim().length < 2 || unsavedChanges} onClick={() => void handlePublish()}>
              Xuất bản
            </DsButton>
          </>
        }
      >
        {unsavedChanges ? <DsNotice tone="warn">Bạn có thay đổi chưa lưu. Hãy lưu bài trước khi xuất bản.</DsNotice> : null}
        <DsField label="Người duyệt nội dung" htmlFor="art-reviewer" required hint="Bác sĩ hoặc quản trị đã đọc và đồng ý với nội dung">
          <DsInput id="art-reviewer" value={reviewer} placeholder="BS.CKII Nguyễn Minh Hùng" onChange={(event) => setReviewer(event.target.value)} />
        </DsField>
      </DsDialog>
    </>
  );
}
