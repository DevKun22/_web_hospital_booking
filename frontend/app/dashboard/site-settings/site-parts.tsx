"use client";

import { useState } from "react";
import { DsButton } from "@/components/ds";
import { uploadImages } from "@/lib/api";
import type { MediaAsset } from "@/lib/types";

// Phần dùng chung của các nhóm cài đặt trang: ô tích có nhãn, thanh lưu và hook tải ảnh lên.

export function Check({ id, checked, disabled, onChange, label, hint }: { id: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="ds-check">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id}>
        {label}
        {hint ? <small>{hint}</small> : null}
      </label>
    </div>
  );
}

// Thanh lưu cuối nhóm cài đặt: chỉ quản trị có quyền sửa mới thấy nút lưu.
export function SaveBar({ canWrite, dirty, busy, saving, label, onSave }: { canWrite: boolean; dirty: boolean; busy: boolean; saving: boolean; label: string; onSave: () => void }) {
  return canWrite ? (
    <div className="ds-savebar">
      <span className="ds-savebar__msg">{dirty ? "Có thay đổi chưa lưu" : "Chưa có thay đổi"}</span>
      <DsButton variant="primary" disabled={!dirty || saving || busy} onClick={onSave}>
        {saving ? "Đang lưu..." : label}
      </DsButton>
    </div>
  ) : (
    <div className="ds-savebar">
      <span className="ds-savebar__msg">Bạn chỉ có quyền xem; chỉ quản trị viên được cập nhật.</span>
    </div>
  );
}

// Tải một ảnh lên rồi giao kết quả cho biểu mẫu; `uploading` là khóa của ô đang tải (rỗng khi không tải).
export function useImageUpload(onNotice: (message: string) => void, onError: (message: string) => void) {
  const [uploading, setUploading] = useState("");

  const upload = async (file: File | undefined, folder: string, key: string, setter: (asset: MediaAsset) => void) => {
    if (!file) return;
    setUploading(key);
    onError("");
    onNotice("");
    try {
      const [asset] = await uploadImages([file], folder);
      if (!asset) throw new Error("Đã tải ảnh nhưng không nhận được đường dẫn ảnh");
      setter(asset);
      onNotice("Đã tải ảnh lên");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tải được ảnh lên");
    } finally {
      setUploading("");
    }
  };

  return { uploading, upload };
}
