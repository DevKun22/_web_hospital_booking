"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageSquareText,
  PhoneCall,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  PUBLIC_CHATBOT_CLOSE_EVENT,
  PUBLIC_CONSULTATION_CLOSE_EVENT,
  PUBLIC_CONSULTATION_OPEN_EVENT,
} from "@/lib/public-ui-events";
import { apiRequest } from "@/lib/api";
import type { ConsultationRequest } from "@/lib/types";

const initialForm = {
  fullName: "",
  phone: "",
  message: "",
};

const suggestionMessages = [
  "Để lại số điện thoại nhận tư vấn miễn phí?",
  "Chưa chắc nên chọn chuyên khoa nào?",
  "Chọn gói khám phù hợp?",
  "Cần tư vấn về chi phí khám?",
];

export function PublicConsultationRequest() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openForm = () => {
      window.dispatchEvent(new Event(PUBLIC_CHATBOT_CLOSE_EVENT));
      setOpen(true);
    };
    const closeForm = () => setOpen(false);
    window.addEventListener(PUBLIC_CONSULTATION_OPEN_EVENT, openForm);
    window.addEventListener(PUBLIC_CONSULTATION_CLOSE_EVENT, closeForm);
    return () => {
      window.removeEventListener(PUBLIC_CONSULTATION_OPEN_EVENT, openForm);
      window.removeEventListener(PUBLIC_CONSULTATION_CLOSE_EVENT, closeForm);
    };
  }, []);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSuggestionIndex(
        (current) => (current + 1) % suggestionMessages.length,
      );
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#consultation") {
        setOpen(true);
      }
    };
    const openFromEvent = () => {
      window.dispatchEvent(new Event(PUBLIC_CHATBOT_CLOSE_EVENT));
      setOpen(true);
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    window.addEventListener("open-consultation-request", openFromEvent);

    return () => {
      window.removeEventListener("hashchange", openFromHash);
      window.removeEventListener("open-consultation-request", openFromEvent);
    };
  }, []);

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    setError("");

    try {
      await apiRequest<ConsultationRequest>("/consultation-requests", {
        method: "POST",
        body: {
          phone: form.phone,
          fullName: form.fullName || null,
          message: form.message || null,
        },
      });
      setNotice(
        "Đã gửi yêu cầu tư vấn. Nhân viên bệnh viện sẽ liên hệ lại theo số điện thoại bạn cung cấp.",
      );
      setForm(initialForm);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không gửi được yêu cầu tư vấn",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="consultation" className="fixed bottom-[5.75rem] left-3 z-[65] sm:bottom-24 sm:left-6">
      {open ? (
        <section className="w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-md border border-[#cfe0f3] bg-white shadow-2xl ring-1 ring-[#d8e9ff]">
          <header className="flex items-center justify-between border-b border-[#e5ebf3] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e7f0fb] text-[#0d4f8b]">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                <span
                  className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#22c55e] ring-2 ring-white"
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[#172033]">
                  Tư vấn miễn phí!
                </h2>
                <p className="truncate text-xs text-[#667892]">
                  Nhân viên sẽ liên hệ lại với bạn
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-[#667892] hover:bg-[#f1f5f9]"
              aria-label="Đóng form tư vấn"
              title="Đóng form tư vấn"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <form onSubmit={submitRequest} className="p-4">
            <div className="ui-soft-glow rounded-md border border-[#cfe4fa] bg-[#f3f8ff] px-3 py-2 text-sm text-[#0d4f8b]">
              <div className="flex gap-2">
                <Sparkles
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>{suggestionMessages[suggestionIndex]}</p>
              </div>
            </div>

            {notice || error ? (
              <div
                className={`mt-3 rounded-md border px-3 py-2 text-sm ${error ? "border-[#f2b8b5] bg-[#fff3f2] text-[#b3261e]" : "border-[#a8dab5] bg-[#f0fff4] text-[#1f7a3a]"}`}
              >
                <div className="flex gap-2">
                  {!error ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  ) : null}
                  <p>{error || notice}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-[#42526b]">
                  Họ tên
                </span>
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  placeholder="Nguyễn Văn A"
                  className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#42526b]">
                  Số điện thoại
                </span>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  inputMode="tel"
                  placeholder="0391234567"
                  className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]"
                  required
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-[#42526b]">
                Nội dung cần tư vấn
              </span>
              <textarea
                value={form.message}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    message: event.target.value,
                  }))
                }
                rows={4}
                placeholder="Ví dụ: Tôi muốn được tư vấn chọn chuyên khoa phù hợp..."
                className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {submitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu tư vấn"}
            </button>
          </form>
        </section>
      ) : (
        <div className="flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          >
            {suggestionMessages[suggestionIndex]}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#0d4f8b] shadow-lg shadow-black/15 ring-1 ring-[#cfe0f3] transition hover:-translate-y-0.5 hover:bg-[#f3f8ff] focus:outline-none focus:ring-4 focus:ring-[#cfe4fa]"
            aria-label="Mở form tư vấn"
            title="Mở form tư vấn"
          >
            <PhoneCall
              className="relative h-5 w-5 transition group-hover:scale-110"
              aria-hidden="true"
            />
            <span className="relative">Tư vấn</span>
          </button>
        </div>
      )}
    </div>
  );
}
