"use client";

import { PUBLIC_CHATBOT_OPEN_EVENT } from "@/lib/public-ui-events";

export function DoctorHelpCta() {
  return (
    <section className="ui-container pb-10 sm:pb-14">
      <div className="grid gap-5 rounded-2xl border border-[var(--public-border)] bg-[var(--public-primary-soft)]/55 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--public-primary)]">Cần hỗ trợ lựa chọn?</p>
          <h2 className="mt-2 text-xl font-bold sm:text-2xl">Chưa rõ nên chọn bác sĩ hay chuyên khoa nào?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)]">
            Trợ lý đặt lịch có thể gợi ý chuyên khoa từ nhu cầu ban đầu và đưa bạn đến đúng danh sách bác sĩ đang công khai.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(PUBLIC_CHATBOT_OPEN_EVENT))}
          className="public-button-primary inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold"
        >
          Nhờ trợ lý hỗ trợ
        </button>
      </div>
    </section>
  );
}
