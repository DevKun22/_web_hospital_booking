"use client";

import { DsButton, DsStatusPill } from "@/components/ds";
import { apiUrl } from "@/lib/api";
import { FileDrop } from "./file-drop";

// Thẻ tệp kết quả của hồ sơ: hiện tệp đã đính kèm (hoặc tệp mới chưa lưu) và vùng tải tệp lên.
export function ResultFileCard({
  recordId,
  hasFile,
  saved,
  canEdit,
  uploading,
  onUpload,
  onRemove,
}: {
  recordId: string;
  hasFile: boolean;
  saved: boolean;
  canEdit: boolean;
  uploading: boolean;
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  return (
    <div className="ds-card">
      <div className="ds-card__head">
        <h3>Tệp kết quả</h3>
        <DsStatusPill>Riêng tư</DsStatusPill>
      </div>
      <div className="ds-card__body">
        {hasFile ? (
          <div className="ds-file">
            <div className="ds-file__text">
              <strong>{saved ? "Tệp kết quả đã đính kèm" : "Tệp mới, chưa lưu"}</strong>
              <small>{saved ? "Đã lưu trong hồ sơ" : "Bấm Lưu hồ sơ để đính kèm"}</small>
            </div>
            {saved ? (
              <a href={apiUrl(`/dashboard/medical-records/${recordId}/file`)} target="_blank" rel="noopener" className="ds-link">
                Mở
              </a>
            ) : null}
            {canEdit ? (
              <DsButton variant="ghost" onClick={onRemove}>
                Gỡ
              </DsButton>
            ) : null}
          </div>
        ) : null}
        {canEdit ? <FileDrop inputId="record-file" busy={uploading} onFile={onUpload} /> : null}
      </div>
    </div>
  );
}
