"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DsButton, DsEditDialog, DsEmptyState, DsField, DsInput, DsLoading, DsNotice, DsPanel, DsSelect, DsStatusPill, DsTextarea, DsToolbar, useConfirm } from "@/components/ds";
import { NumberStepper } from "@/components/ui/number-stepper";
import { apiRequest } from "@/lib/api";
import { useDashboardFAQs } from "@/lib/dashboard-site-settings-query";
import { publishPublicContentUpdated } from "@/lib/public-content-sync";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardFAQ } from "@/lib/types";
import { Check } from "./site-parts";
import { emptyFAQForm, faqCategoryLabels, parseKeywords, toFAQForm, toNullable, type FAQForm } from "./site-model";

// Nhóm "Hỏi đáp": danh sách có lọc và hộp thoại tạo/sửa (một nguồn câu hỏi cho trang Hỏi đáp và trợ lý ảo). Được gắn khi mở nhóm này nên luôn bắt đầu sạch.

export function FaqsTab({
  canWrite,
  canManage,
  onNotice,
  onError,
}: {
  canWrite: boolean;
  canManage: boolean;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [editing, setEditing] = useState<{ faq: DashboardFAQ | null } | null>(null);
  const [form, setForm] = useState<FAQForm>(emptyFAQForm);
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);

  const filters = useMemo(() => ({ category: category || undefined, isActive: activeFilter || undefined }), [category, activeFilter]);
  const query = useDashboardFAQs(filters, canManage);
  const faqs = query.data ?? [];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "faqs"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "faqs"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicBootstrap() }),
    ]);
    publishPublicContentUpdated();
  };

  const close = () => {
    setEditing(null);
  };

  const openFAQ = (faq: DashboardFAQ | null) => {
    setForm(faq ? toFAQForm(faq) : emptyFAQForm);
    setEditing({ faq });
  };

  const patch = (changes: Partial<FAQForm>) => setForm((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (!canManage || !editing) return;
    setSaving(true);
    onError("");
    onNotice("");
    try {
      const body = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        category: toNullable(form.category),
        order: Number(form.order || 0),
        keywords: parseKeywords(form.keywords),
        showOnWeb: form.showOnWeb,
        useInChatbot: form.useInChatbot,
        isActive: form.isActive,
      };
      if (editing.faq) {
        await apiRequest<DashboardFAQ>(`/dashboard/faqs/${editing.faq.id}`, { method: "PATCH", body });
        onNotice("Đã cập nhật câu hỏi thường gặp");
      } else {
        await apiRequest<DashboardFAQ>("/dashboard/faqs", { method: "POST", body });
        onNotice("Đã tạo câu hỏi thường gặp");
      }
      close();
      await invalidate();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không lưu được câu hỏi thường gặp");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (faq: DashboardFAQ) => {
    if (!canManage) return;
    onError("");
    onNotice("");
    try {
      await apiRequest<DashboardFAQ>(`/dashboard/faqs/${faq.id}`, { method: "PATCH", body: { isActive: !faq.isActive } });
      close();
      onNotice(faq.isActive ? "Đã tắt câu hỏi" : "Đã bật câu hỏi");
      await invalidate();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được câu hỏi");
    }
  };

  const askDelete = async () => {
    if (!(await confirm({ title: "Xoá câu hỏi này?", message: "Không hoàn tác được.", confirmLabel: "Xoá câu hỏi", tone: "danger" }))) return;
    await remove();
  };

  const remove = async () => {
    if (!canWrite || !editing?.faq) return;
    setSaving(true);
    onError("");
    onNotice("");
    try {
      await apiRequest<DashboardFAQ>(`/dashboard/faqs/${editing.faq.id}`, { method: "DELETE" });
      close();
      onNotice("Đã xoá câu hỏi thường gặp");
      await invalidate();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không xoá được câu hỏi thường gặp");
    } finally {
      setSaving(false);
    }
  };

  const current = editing?.faq ?? null;

  return (
    <>
      {query.error ? <DsNotice tone="bad">{query.error instanceof Error ? query.error.message : "Không tải được câu hỏi thường gặp"}</DsNotice> : null}
      <DsPanel flush>
        <DsToolbar>
          <div style={{ minWidth: 160, flex: "1 1 200px" }}>
            <DsSelect aria-label="Lọc theo nhóm" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Mọi nhóm</option>
              {Object.entries(faqCategoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </DsSelect>
          </div>
          <div style={{ minWidth: 140 }}>
            <DsSelect aria-label="Lọc theo trạng thái" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
              <option value="">Mọi trạng thái</option>
              <option value="true">Đang bật</option>
              <option value="false">Đang tắt</option>
            </DsSelect>
          </div>
          <DsButton variant="primary" onClick={() => openFAQ(null)}>Tạo câu hỏi</DsButton>
        </DsToolbar>
        {query.isLoading ? (
          <DsLoading />
        ) : faqs.length ? (
          <div role="listbox" aria-label="Danh sách câu hỏi thường gặp">
            {faqs.map((faq) => (
              <button key={faq.id} type="button" role="option" className="ds-listrow" aria-selected={current?.id === faq.id} onClick={() => openFAQ(faq)}>
                <span className="ds-listrow__main">
                  <strong>{faq.question}</strong>
                  <small>{faqCategoryLabels[faq.category || ""] || faq.category || "Chưa phân nhóm"} · {faq.showOnWeb ? "Hiện trên web" : "Ẩn trên web"} · {faq.useInChatbot ? "Dùng cho trợ lý" : "Không dùng cho trợ lý"}</small>
                </span>
                <DsStatusPill tone={faq.isActive ? "good" : "neutral"}>{faq.isActive ? "Đang bật" : "Đang tắt"}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có câu hỏi phù hợp" />
        )}
      </DsPanel>

      {editing ? (
        <DsEditDialog
          size="lg"
          title={current ? "Sửa câu hỏi" : "Tạo câu hỏi"}
          badge={current ? <DsStatusPill tone={current.isActive ? "good" : "neutral"}>{current.isActive ? "Đang bật" : "Đang tắt"}</DsStatusPill> : undefined}
          onClose={close}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <p className="ds-hint" style={{ margin: 0 }}>Một nguồn câu hỏi cho trang Hỏi đáp và trợ lý ảo.</p>
            <DsField label="Câu hỏi" htmlFor="faq-question" required>
              <DsTextarea id="faq-question" rows={2} value={form.question} onChange={(event) => patch({ question: event.target.value })} />
            </DsField>
            <DsField label="Câu trả lời" htmlFor="faq-answer" required>
              <DsTextarea id="faq-answer" rows={5} value={form.answer} onChange={(event) => patch({ answer: event.target.value })} />
            </DsField>
            <div className="ds-grid-fields">
              <DsField label="Nhóm" htmlFor="faq-category">
                <DsSelect id="faq-category" value={form.category} onChange={(event) => patch({ category: event.target.value })}>
                  <option value="">Chưa phân nhóm</option>
                  {Object.entries(faqCategoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </DsSelect>
              </DsField>
              <DsField label="Thứ tự" hint="Số nhỏ hiển thị trước">
                <NumberStepper label="Thứ tự hiển thị" value={Number(form.order || 0)} min={0} max={999} onChange={(value) => patch({ order: String(value) })} />
              </DsField>
            </div>
            <DsField label="Từ khóa" htmlFor="faq-keywords" hint="Cách nhau bằng dấu phẩy; giúp trợ lý ảo tìm đúng câu hỏi">
              <DsInput id="faq-keywords" value={form.keywords} onChange={(event) => patch({ keywords: event.target.value })} />
            </DsField>
            <Check id="faq-web" checked={form.showOnWeb} onChange={(showOnWeb) => patch({ showOnWeb })} label="Hiện trên trang Hỏi đáp" />
            <Check id="faq-bot" checked={form.useInChatbot} onChange={(useInChatbot) => patch({ useInChatbot })} label="Dùng cho trợ lý ảo" />
            <Check id="faq-active" checked={form.isActive} onChange={(isActive) => patch({ isActive })} label="Đang bật" />
            <div className="ds-form-actions">
              {current ? (
                <>
                  <DsButton onClick={() => void toggle(current)}>{current.isActive ? "Tắt ngay" : "Bật ngay"}</DsButton>
                  {canWrite ? <DsButton variant="ghost" onClick={() => void askDelete()}>Xoá</DsButton> : null}
                </>
              ) : null}
              <DsButton onClick={close}>Đóng</DsButton>
              <DsButton variant="primary" disabled={saving || !form.question.trim() || !form.answer.trim()} onClick={() => void save()}>
                {saving ? "Đang lưu..." : current ? "Lưu thay đổi" : "Tạo câu hỏi"}
              </DsButton>
            </div>
          </div>
        </DsEditDialog>
      ) : null}
    </>
  );
}
