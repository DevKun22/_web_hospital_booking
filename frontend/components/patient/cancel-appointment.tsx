"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutationToast } from "@/components/patient/patient-toast";
import { useCancelAppointment } from "@/features/portal/hooks";

const MIN_REASON = 3;

// Hủy lịch ở trang chi tiết: nút mở ô lý do, xác nhận mới gửi.
export function CancelAppointment({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useCancelAppointment(() => {
    setOpen(false);
    setReason("");
  });
  useMutationToast(cancel, { success: "Đã hủy lịch hẹn.", fallbackError: "Không hủy được lịch. Thử lại sau." });
  const tooShort = reason.trim().length < MIN_REASON;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[var(--public-danger)] hover:bg-[var(--public-danger-soft)]">
        Hủy lịch
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] p-3">
      <label className="block text-sm font-semibold text-[var(--public-danger)]">
        Lý do hủy lịch
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Nhập lý do cụ thể (tối thiểu 3 ký tự)"
          className="ui-field mt-1.5 w-full px-3 py-2.5 text-base font-normal text-[var(--public-ink)] sm:text-sm"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => !tooShort && cancel.mutate({ id, reason: reason.trim() })}
          aria-disabled={tooShort}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--public-danger)] px-4 text-sm font-semibold text-white ${tooShort ? "opacity-60" : ""}`}
        >
          {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Xác nhận hủy
        </button>
        <button type="button" onClick={() => { setOpen(false); setReason(""); }} className="public-button-secondary min-h-11 rounded-lg px-4 text-sm font-semibold">
          Giữ lịch
        </button>
      </div>
    </div>
  );
}
