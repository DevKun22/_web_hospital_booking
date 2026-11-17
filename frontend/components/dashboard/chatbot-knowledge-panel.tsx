"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DsButton, DsDataTable, DsKeyValue, DsLoading, DsNotice, DsPanel, useToast, type DsColumn } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { formatVietnamDateTime } from "@/lib/date";

// Kho tri thức của chatbot: nguồn trả lời (FAQ, chuyên khoa, bác sĩ, gói khám, chính sách, bài viết) và nút cập nhật ngay.
// Kho cũng tự đồng bộ ngầm mỗi 10 phút và khi bài viết được xuất bản, nút này dành cho lúc cần thấy thay đổi ngay.

type KnowledgeStats = {
  total: number;
  embedded: number;
  embeddingConfigured: boolean;
  embeddingModel: string;
  lastUpdatedAt: string | null;
  byType: Record<string, { sources: number; chunks: number }>;
};

type SyncResult = { created: number; updated: number; deleted: number; embedded: number; embeddingError: string | null; stats: KnowledgeStats };

// Mỗi loại dữ liệu: tên, đơn vị đếm và nơi sửa. "Đoạn" là mảnh nhỏ Kun tìm và trích khi trả lời; một nguồn dài (bài viết) được cắt thành nhiều đoạn.
const TYPES: { type: string; label: string; unit: string; origin: string }[] = [
  { type: "FAQ", label: "Hỏi đáp", unit: "câu", origin: "Mục Hỏi đáp" },
  { type: "DEPARTMENT", label: "Chuyên khoa", unit: "khoa", origin: "Danh mục Chuyên khoa" },
  { type: "DOCTOR", label: "Bác sĩ", unit: "bác sĩ", origin: "Danh mục Bác sĩ" },
  { type: "PACKAGE", label: "Gói khám", unit: "gói", origin: "Danh mục Gói khám" },
  { type: "POLICY", label: "Chính sách đặt lịch", unit: "mục", origin: "Cài đặt chính sách đặt lịch" },
  { type: "SITE", label: "Thông tin liên hệ", unit: "mục", origin: "Cài đặt trang" },
  { type: "ARTICLE", label: "Bài viết kiến thức", unit: "bài", origin: "Chỉ bài đã xuất bản" },
];

type TypeRow = { type: string; label: string; origin: string; sources: string; chunks: number };

const columns: DsColumn<TypeRow>[] = [
  { key: "label", header: "Loại dữ liệu", cell: (row) => <strong>{row.label}</strong> },
  { key: "sources", header: "Số nguồn", cell: (row) => row.sources },
  { key: "chunks", header: "Số đoạn", cell: (row) => row.chunks },
  { key: "origin", header: "Lấy từ", cell: (row) => <span style={{ color: "var(--ds-muted)" }}>{row.origin}</span> },
];

const QUERY_KEY = ["dashboard", "chatbot", "knowledge"];

export function ChatbotKnowledgePanel({ canSync }: { canSync: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: () => apiRequest<KnowledgeStats>("/dashboard/chatbot/knowledge"), staleTime: 30_000 });
  const stats = query.data;
  const rows: TypeRow[] = TYPES.flatMap((item) => {
    const entry = stats?.byType[item.type];
    return entry ? [{ type: item.type, label: item.label, origin: item.origin, sources: `${entry.sources} ${item.unit}`, chunks: entry.chunks }] : [];
  });

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await apiRequest<SyncResult>("/dashboard/chatbot/knowledge/sync", { method: "POST" });
      setLastSync(result);
      queryClient.setQueryData(QUERY_KEY, result.stats);
      toast.success(result.created + result.updated + result.deleted === 0 ? "Kho tri thức đã là bản mới nhất" : `Đã cập nhật: thêm ${result.created}, sửa ${result.updated}, xóa ${result.deleted} đoạn`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không cập nhật được kho tri thức");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <DsPanel title="Kho tri thức" flush={false}>
      <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
        <p className="ds-hint" style={{ margin: 0 }}>
          Đây là những gì Kun biết để trả lời câu hỏi thông tin, dựng sẵn từ dữ liệu của hệ thống. Sửa hỏi đáp, gói khám, bác sĩ thì kho tự cập nhật trong khoảng 10 phút; bài viết xuất bản hoặc gỡ thì cập nhật ngay. Bài chưa xuất bản không nằm trong kho.
        </p>
        {query.isLoading ? <DsLoading label="Đang tải kho tri thức..." /> : null}
        {query.error ? <DsNotice tone="bad">{query.error instanceof Error ? query.error.message : "Không tải được kho tri thức"}</DsNotice> : null}
        {stats ? (
          <>
            <DsDataTable
              caption="Nội dung Kun đang biết"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.type}
              emptyTitle="Kho chưa có nội dung"
            />
            <p className="ds-hint" style={{ margin: 0 }}>
              Số nguồn là số bài, bác sĩ, gói... đang có. Số đoạn là số mảnh Kun tìm kiếm; một bài viết dài được cắt theo từng mục nên một bài thành nhiều đoạn.
            </p>
            <DsKeyValue
              items={[
                { label: "Tìm theo ý nghĩa", value: stats.embeddingConfigured ? `${stats.embedded}/${stats.total} đoạn đã sẵn sàng` : "Chưa cấu hình khóa API" },
                { label: "Cập nhật lần cuối", value: stats.lastUpdatedAt ? formatVietnamDateTime(stats.lastUpdatedAt) : "Chưa có" },
              ]}
            />
            {stats.total === 0 ? <DsNotice tone="warn">Kho chưa có đoạn nào. Bấm Cập nhật kho tri thức để dựng lần đầu.</DsNotice> : null}
            {stats.embeddingConfigured && stats.total > 0 && stats.embedded < stats.total ? (
              <DsNotice tone="warn">Một số đoạn chưa có vector nên chỉ tìm được theo từ khóa. Bấm cập nhật để thử nhúng lại.</DsNotice>
            ) : null}
            {!stats.embeddingConfigured ? <DsNotice tone="warn">Chưa có khóa API Gemini trên máy chủ: chatbot chỉ tìm theo từ khóa và dùng câu trả lời dự phòng.</DsNotice> : null}
          </>
        ) : null}
        {lastSync?.embeddingError ? <DsNotice tone="bad">Lỗi khi nhúng vector: {lastSync.embeddingError}</DsNotice> : null}
        <div>
          <DsButton variant="primary" loading={syncing} disabled={!canSync} onClick={() => void sync()}>
            Cập nhật kho tri thức
          </DsButton>
          {!canSync ? <span className="ds-hint" style={{ marginLeft: 8 }}>Chỉ quản trị viên được cập nhật.</span> : null}
        </div>
      </div>
    </DsPanel>
  );
}
