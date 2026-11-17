"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { DsButton, DsDataTable, DsInput, DsNotice, DsPageHeader, DsPanel, DsStatusPill, DsTabs, DsToolbar, type DsColumn } from "@/components/ds";
import { ArticleEditorDialog } from "@/components/dashboard/article-editor-dialog";
import { apiRequest } from "@/lib/api";
import { ARTICLE_STAGE_LABEL, ARTICLE_STAGE_TONE, getArticleStage } from "@/lib/article-ui";
import { useAuth } from "@/lib/auth";
import { useDashboardDepartments } from "@/lib/dashboard-departments-query";
import { can } from "@/lib/permissions";
import type { ArticleSummary, ListResult } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Bài viết kiến thức sức khỏe: chờ duyệt → bác sĩ duyệt nội dung → quản trị xuất bản. Bài đã xuất bản hiện ở /kien-thuc và là nguồn tri thức
// của chatbot Kun. Soạn bài trong hộp thoại lớn (components/dashboard/article-editor-dialog).

const stageTabs = [
  { id: "", label: "Tất cả" },
  { id: "PENDING_REVIEW", label: "Chờ duyệt" },
  { id: "READY", label: "Chờ xuất bản" },
  { id: "PUBLISHED", label: "Đã xuất bản" },
];

const formatDate = (value: string) => new Date(value).toLocaleDateString("vi-VN");

type Editing = { id: string | null } | null;

export default function ArticlesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);

  const canWrite = can(user, "article.write");
  const term = useDebouncedValue(search.trim());
  const query = useMemo(() => ({ q: term || undefined, stage: stage || undefined, page, limit: 10 }), [page, stage, term]);
  const listQuery = useQuery({
    queryKey: ["dashboard", "articles", "list", query],
    queryFn: () => apiRequest<ListResult<ArticleSummary>>("/dashboard/articles", { query }),
    placeholderData: keepPreviousData,
    enabled: canWrite,
  });
  const articles = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const pagination = listQuery.data?.pagination ?? { page, limit: 10, total: 0, totalPages: 1 };
  const departmentsQuery = useDashboardDepartments({ limit: 100 });
  const errorMessage = listQuery.error instanceof Error ? listQuery.error.message : "";
  // Gợi ý danh mục từ các bài đã có, để đặt tên nhất quán.
  const categories = useMemo(() => Array.from(new Set(articles.map((item) => item.category).filter((name): name is string => Boolean(name)))).sort(), [articles]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard", "articles", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard", "chatbot"] });
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
    {
      key: "stage",
      header: "Giai đoạn",
      cell: (row) => {
        const current = getArticleStage(row);
        return <DsStatusPill tone={ARTICLE_STAGE_TONE[current]}>{ARTICLE_STAGE_LABEL[current]}</DsStatusPill>;
      },
    },
    { key: "author", header: "Người viết", cell: (row) => row.authorName || "-" },
    { key: "reviewer", header: "Người duyệt", cell: (row) => row.reviewerName || "-" },
    { key: "updated", header: "Cập nhật", cell: (row) => formatDate(row.updatedAt) },
  ];

  return (
    <>
      <DsPageHeader title="Kiến thức sức khỏe" description="Bài viết cho trang Kiến thức; bài đã xuất bản cũng là nguồn tri thức của chatbot Kun" />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>{errorMessage ? <DsNotice tone="bad">{errorMessage}</DsNotice> : null}</div>
      <DsPanel flush>
        <form onSubmit={(event) => event.preventDefault()} aria-label="Lọc bài viết">
          <DsToolbar>
            <div style={{ minWidth: 180, flex: "1 1 240px" }}>
              <DsInput aria-label="Tìm bài viết" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Gõ tiêu đề để lọc" />
            </div>
            <DsButton variant="primary" onClick={() => setEditing({ id: null })}>
              <Plus aria-hidden="true" />
              Viết bài mới
            </DsButton>
          </DsToolbar>
        </form>
        <DsTabs label="Lọc bài viết theo giai đoạn" items={stageTabs} value={stage} onChange={(id) => { setStage(id); setPage(1); }} />
        <DsDataTable
          caption="Danh sách bài viết"
          columns={columns}
          rows={articles}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading}
          emptyTitle="Chưa có bài viết"
          emptyDescription="Bấm Viết bài mới để soạn bản nháp đầu tiên."
          onRowClick={(row) => setEditing({ id: row.id })}
        />
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

      {editing ? (
        <ArticleEditorDialog articleId={editing.id} departments={departmentsQuery.data?.items ?? []} categories={categories} onClose={() => setEditing(null)} onChanged={refresh} />
      ) : null}
    </>
  );
}
