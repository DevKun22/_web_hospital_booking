"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DsButton, DsKeyValue, DsLoading, DsNotice, DsPanel, useToast } from "@/components/ds";
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
  byType: Record<string, number>;
};

type SyncResult = { created: number; updated: number; deleted: number; embedded: number; embeddingError: string | null; stats: KnowledgeStats };

const TYPE_LABEL: Record<string, string> = {
  FAQ: "Hỏi đáp",
  DEPARTMENT: "Chuyên khoa",
  DOCTOR: "Bác sĩ",
  PACKAGE: "Gói khám",
  POLICY: "Chính sách",
  SITE: "Thông tin liên hệ",
  ARTICLE: "Bài viết kiến thức",
};

const QUERY_KEY = ["dashboard", "chatbot", "knowledge"];

export function ChatbotKnowledgePanel({ canSync }: { canSync: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: () => apiRequest<KnowledgeStats>("/dashboard/chatbot/knowledge"), staleTime: 30_000 });
  const stats = query.data;

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
          Kun trả lời câu hỏi thông tin dựa trên các đoạn tri thức này, dựng từ dữ liệu đang có. Quản trị sửa FAQ, gói khám, bác sĩ thì kho tự cập nhật trong vòng khoảng 10 phút; bài viết xuất bản thì cập nhật ngay.
        </p>
        {query.isLoading ? <DsLoading label="Đang tải kho tri thức..." /> : null}
        {query.error ? <DsNotice tone="bad">{query.error instanceof Error ? query.error.message : "Không tải được kho tri thức"}</DsNotice> : null}
        {stats ? (
          <>
            <DsKeyValue
              items={[
                { label: "Tổng số đoạn", value: stats.total },
                { label: "Đã nhúng vector (tìm theo ý nghĩa)", value: `${stats.embedded}/${stats.total}` },
                { label: "Mô hình nhúng", value: stats.embeddingConfigured ? stats.embeddingModel : "Chưa cấu hình khóa API" },
                { label: "Cập nhật lần cuối", value: stats.lastUpdatedAt ? formatVietnamDateTime(stats.lastUpdatedAt) : "Chưa có" },
                ...Object.entries(stats.byType).map(([type, count]) => ({ label: TYPE_LABEL[type] ?? type, value: count })),
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
