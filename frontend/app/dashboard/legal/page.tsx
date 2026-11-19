"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DsButton, DsField, DsInput, DsLoading, DsNotice, DsPageHeader, DsPanel, DsTextarea, useActionToast } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { LegalDoc, LegalDocuments } from "@/lib/legal";

// Điều khoản sử dụng và chính sách bảo mật: cơ sở khám tự soạn (Markdown). Có điều khoản thì người khám phải đồng ý trước khi gửi OTP;
// sửa và lưu là tạo phiên bản mới nên mọi người phải đồng ý lại. Để trống nội dung là tắt văn bản đó.

const queryKey = ["dashboard", "legal"];
const formatDate = (value: string) => new Date(value).toLocaleString("vi-VN");

function LegalEditor({ docKey, label, hint, doc, canEdit }: { docKey: "terms" | "privacy"; label: string; hint: string; doc: LegalDoc | null; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(doc?.title ?? label);
  const [body, setBody] = useState(doc?.body ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useActionToast({ notice, error, clear: () => { setNotice(""); setError(""); } });

  const save = useMutation({
    mutationFn: () => apiRequest<LegalDocuments>("/dashboard/legal", { method: "PUT", body: { [docKey]: { title: title.trim() || label, body: body.trim() } } }),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      void queryClient.invalidateQueries({ queryKey: ["public", "legal"] });
      setNotice(body.trim() ? "Đã lưu, người khám sẽ được yêu cầu đồng ý lại" : "Đã tắt văn bản này");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Không lưu được"),
  });

  return (
    <DsPanel title={label}>
      <div style={{ display: "grid", gap: 12 }}>
        <p className="ds-hint" style={{ margin: 0 }}>{hint}</p>
        <p className="ds-hint" style={{ margin: 0 }}>{doc ? `Đang áp dụng, cập nhật ${formatDate(doc.updatedAt)}.` : "Chưa soạn: người khám không bị yêu cầu đồng ý."}</p>
        <DsField label="Tiêu đề" htmlFor={`${docKey}-title`}>
          <DsInput id={`${docKey}-title`} maxLength={160} value={title} disabled={!canEdit} onChange={(event) => setTitle(event.target.value)} />
        </DsField>
        <DsField label="Nội dung (Markdown)" htmlFor={`${docKey}-body`} hint="Dùng ## cho đề mục, - cho danh sách. Để trống rồi lưu để tắt.">
          <DsTextarea id={`${docKey}-body`} rows={14} maxLength={60000} value={body} disabled={!canEdit} onChange={(event) => setBody(event.target.value)} />
        </DsField>
        <div>
          <DsButton variant="primary" disabled={!canEdit} loading={save.isPending} onClick={() => save.mutate()}>Lưu</DsButton>
        </div>
      </div>
    </DsPanel>
  );
}

export default function LegalPage() {
  const { user } = useAuth();
  const canView = can(user, "settings.view");
  const canEdit = can(user, "settings.edit");
  const query = useQuery({ queryKey, queryFn: () => apiRequest<LegalDocuments>("/dashboard/legal"), enabled: canView, staleTime: 0 });
  const data = query.data;

  return (
    <>
      <DsPageHeader title="Điều khoản" description="Văn bản người khám phải đồng ý trước khi nhận mã OTP" />
      {!canView ? <DsNotice tone="bad">Bạn chưa được cấp quyền xem cấu hình website.</DsNotice> : null}
      {query.isLoading ? <DsLoading label="Đang tải văn bản..." /> : null}
      {query.error ? <DsNotice tone="bad">{query.error instanceof Error ? query.error.message : "Không tải được dữ liệu"}</DsNotice> : null}
      {data ? (
        <div style={{ display: "grid", gap: 14 }}>
          <LegalEditor docKey="terms" label="Điều khoản sử dụng" hint="Có nội dung thì ô đồng ý hiện ở màn đăng nhập và đặt lịch. Nội dung pháp lý do cơ sở khám soạn và chịu trách nhiệm." doc={data.terms} canEdit={canEdit} />
          <LegalEditor docKey="privacy" label="Chính sách bảo mật" hint="Hiện ở trang công khai và được nối từ ô đồng ý điều khoản." doc={data.privacy} canEdit={canEdit} />
        </div>
      ) : null}
    </>
  );
}
