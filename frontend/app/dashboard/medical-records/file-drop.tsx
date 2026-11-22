"use client";

import { useState } from "react";

// Vùng kéo thả hoặc chọn tệp kết quả (PDF hoặc ảnh); tệp lưu riêng tư, người khám chỉ xem được sau khi công bố.
export function FileDrop({ inputId, busy, onFile }: { inputId: string; busy: boolean; onFile: (file: File | undefined) => void }) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`ds-drop${over ? " is-over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onFile(event.dataTransfer.files?.[0]);
      }}
    >
      {busy ? (
        "Đang tải tệp lên..."
      ) : (
        <>
          Kéo thả tệp vào đây hoặc <label htmlFor={inputId}>chọn từ máy</label>
          <input
            id={inputId}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="ds-hint" style={{ marginTop: 4 }}>
            PDF, JPG, PNG, WEBP · tối đa 10 MB · lưu riêng tư, người khám chỉ xem được sau khi công bố
          </div>
        </>
      )}
    </div>
  );
}
