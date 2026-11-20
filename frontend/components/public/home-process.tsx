"use client";

import {
  Bell,
  CalendarCheck,
  CalendarSearch,
  Check,
  ClipboardList,
  FileText,
  Pause,
  Play,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { appointmentStatusLabel } from "@/lib/appointment-status";

// Mục quy trình ở trang chủ: timeline bốn bước đặt lịch tự chạy kèm khung màn hình minh họa, và thẻ "sau khi đặt lịch" cho phần quản lý lịch hẹn.
// Chỉ chạy khi mục đang nằm trong màn hình và thẻ trình duyệt đang mở; dừng khi rê chuột hoặc dùng bàn phím trong mục; có nút tạm dừng; tắt hẳn khi
// hệ điều hành bật giảm chuyển động. Bốn bước luôn là một danh sách có thứ tự trong trang; khung minh họa chỉ để nhìn nên ẩn khỏi trình đọc màn hình.

const STEP_MS = 4200;
const LAST_STEP_MS = 6200;

const STEPS = [
  { title: "Chọn dịch vụ", text: "Chuyên khoa, bác sĩ hoặc gói khám phù hợp với nhu cầu.", href: "/chuyen-khoa", link: "Xem chuyên khoa", icon: Stethoscope },
  { title: "Chọn giờ trống", text: "Xem ngày và giờ còn tiếp nhận, chi phí dự kiến hiển thị trước.", href: "/dat-lich", link: "Xem giờ trống", icon: CalendarSearch },
  { title: "Điền thông tin", text: "Họ tên, email và số điện thoại liên hệ, không cần tạo tài khoản.", href: "/dat-lich", link: "Mở biểu mẫu", icon: ClipboardList },
  { title: "Xác thực OTP", text: "Nhập mã gửi về email để xác nhận và nhận mã lịch hẹn.", href: "/huong-dan/dat-lich", link: "Xem hướng dẫn", icon: ShieldCheck },
] as const;

const MANAGE_ITEMS = [
  { icon: CalendarCheck, text: "Theo dõi trạng thái lịch hẹn" },
  { icon: FileText, text: "Xem chi tiết hoặc hủy lịch khi cần" },
  { icon: ReceiptText, text: "Xem hóa đơn và thanh toán" },
  { icon: UserRound, text: "Xem kết quả khám và đơn thuốc" },
  { icon: Bell, text: "Nhận thông báo và nhắc lịch" },
];

const TRACK_STATUSES = [appointmentStatusLabel.CONFIRMED, appointmentStatusLabel.CHECKED_IN, appointmentStatusLabel.IN_PROGRESS, appointmentStatusLabel.COMPLETED];

const delay = (seconds: number) => ({ animationDelay: `${seconds}s` });

function Bar({ className = "" }: { className?: string }) {
  return <span className={`block h-2.5 rounded bg-[var(--public-border)] ${className}`} />;
}

function Field({ label, width, order }: { label: string; width: string; order: number }) {
  return (
    <div className="proc-fade" style={delay(order * 0.45)}>
      <p className="text-xs text-[var(--public-muted)]">{label}</p>
      <div className="mt-1 flex h-9 items-center rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] px-3">
        <span className="proc-grow block h-2.5 rounded bg-[var(--public-primary-soft)]" style={{ width, animationDelay: `${order * 0.45 + 0.25}s` }} />
      </div>
    </div>
  );
}

/** Màn hình minh họa của từng bước; `key` đổi theo bước nên hoạt ảnh chạy lại từ đầu. */
function MockScreen({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {["Chuyên khoa", "Bác sĩ", "Gói khám"].map((tab, index) => (
            <span key={tab} className={`rounded-full px-3 py-1 text-xs font-medium ${index === 0 ? "bg-[var(--public-primary)] text-white" : "bg-[var(--public-surface-muted)] text-[var(--public-muted)]"}`}>{tab}</span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span
              key={index}
              className={`proc-pop flex h-12 items-center justify-center rounded-xl border ${index === 2 ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary)]" : "border-[var(--public-border)] bg-[var(--public-surface)]"}`}
              style={delay(index * 0.12)}
            >
              {index === 2 ? <Check className="h-4 w-4" aria-hidden="true" /> : <Bar className="w-10" />}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (step === 1) {
    const times = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "14:00", "14:30"];
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <span key={index} className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium ${index === 1 ? "bg-[var(--public-primary)] text-white" : "bg-[var(--public-surface-muted)] text-[var(--public-muted)]"}`}>{index === 1 ? "T3" : ""}</span>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {times.map((time, index) => (
            <span
              key={time}
              className={`proc-pop flex h-10 items-center justify-center rounded-lg border text-sm font-medium tabular-nums ${index === 3 ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white" : index === 5 ? "border-[var(--public-border)] text-[var(--public-muted)] line-through" : "border-[var(--public-border)] bg-[var(--public-surface)]"}`}
              style={delay(index * 0.08)}
            >
              {time}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="space-y-2.5">
        <Field label="Họ và tên" width="62%" order={0} />
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Email" width="78%" order={1} />
          <Field label="Số điện thoại" width="48%" order={2} />
        </div>
        <span className="proc-pop inline-flex h-9 items-center rounded-lg bg-[var(--public-primary)] px-4 text-sm font-medium text-white" style={delay(1.9)}>Gửi mã OTP</span>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <span key={index} className="proc-pop flex h-11 w-9 items-center justify-center rounded-lg border border-[var(--public-primary)] bg-[var(--public-surface)] text-lg font-medium" style={delay(0.2 + index * 0.18)}>•</span>
        ))}
      </div>
      <div className="proc-fade flex items-center gap-3 rounded-xl bg-[var(--public-success-soft)] p-3 text-[var(--public-success)]" style={delay(1.6)}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--public-success)] text-white"><Check className="h-5 w-5" aria-hidden="true" /></span>
        <span>
          <span className="block text-sm font-semibold">Lịch hẹn đã được xác nhận</span>
          <span className="mt-1.5 flex items-center gap-2 text-xs">Mã lịch hẹn <Bar className="w-16 bg-[var(--public-success)]/30" /></span>
        </span>
      </div>
    </div>
  );
}

export function HomeProcess({ title = "Đặt lịch và quản lý lịch hẹn" }: { title?: string }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(0);
  const [manualPause, setManualPause] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(query.matches);
    const syncVisibility = () => setPageVisible(document.visibilityState === "visible");
    syncMotion();
    syncVisibility();
    query.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => {
      query.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
      observer.disconnect();
    };
  }, []);

  const playing = inView && pageVisible && !manualPause && !hovering && !reducedMotion;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % STEPS.length), active === STEPS.length - 1 ? LAST_STEP_MS : STEP_MS);
    return () => window.clearTimeout(timer);
  }, [active, playing]);

  const tracking = active === STEPS.length - 1;

  return (
    <section
      id="quy-trinh"
      ref={sectionRef}
      aria-labelledby="process-title"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="scroll-mt-24 bg-[var(--public-canvas)]"
    >
      <div className="ui-container py-10 sm:py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="process-title" className="text-xl font-semibold sm:text-2xl">{title}</h2>
            <span aria-hidden="true" className="mt-2 block h-[3px] w-10 rounded bg-[var(--public-care-mint)]" />
            <p className="mt-2 text-base text-[var(--public-muted)]">Từ chọn dịch vụ đến theo dõi lịch hẹn, trên một nền tảng.</p>
          </div>
          <Link href="/huong-dan/dat-lich" className="hidden shrink-0 py-2 text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4 sm:block">Xem hướng dẫn chi tiết</Link>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Đặt lịch trong 4 bước</h3>
              <button
                type="button"
                onClick={() => setManualPause((current) => !current)}
                aria-pressed={manualPause}
                aria-label={manualPause ? "Tiếp tục tự chạy minh họa" : "Tạm dừng minh họa"}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
              >
                {manualPause ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                {manualPause ? "Chạy" : "Dừng"}
              </button>
            </div>

            <ol className="mt-5 grid gap-4 md:grid-cols-4 md:gap-3">
              {STEPS.map((step, index) => {
                const done = index < active;
                const current = index === active;
                const Icon = step.icon;
                return (
                  <li key={step.title} className="relative flex gap-3 md:flex-col md:gap-0">
                    {index < STEPS.length - 1 ? (
                      <>
                        <span aria-hidden="true" className={`absolute left-5 top-11 h-[calc(100%-1rem)] w-0.5 md:hidden ${done ? "bg-[var(--public-primary)]" : "bg-[var(--public-border)]"}`} />
                        <span aria-hidden="true" className={`absolute left-[3.25rem] top-5 hidden h-0.5 w-[calc(100%-2.5rem)] md:block ${done ? "bg-[var(--public-primary)]" : "bg-[var(--public-border)]"}`} />
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setActive(index)}
                      aria-current={current ? "step" : undefined}
                      aria-label={`Bước ${index + 1}: ${step.title}`}
                      className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${current ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white" : done ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary)]" : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-muted)]"}`}
                    >
                      {done ? <Check className="h-5 w-5" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
                    </button>
                    <div className="min-w-0 md:mt-3">
                      <h4 className={`text-sm font-semibold ${current ? "text-[var(--public-primary)]" : "text-[var(--public-ink)]"}`}>{index + 1}. {step.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{step.text}</p>
                      <Link href={step.href} className="mt-1 inline-flex min-h-10 items-center text-sm font-medium text-[var(--public-primary)] underline-offset-4 hover:underline">{step.link}</Link>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div aria-hidden="true" className="mt-5 overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-canvas)]">
              <div className="flex items-center justify-between border-b border-[var(--public-border)] bg-[var(--public-surface)] px-3 py-2">
                <span className="flex gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-[var(--public-border)]" />
                  <i className="h-2.5 w-2.5 rounded-full bg-[var(--public-border)]" />
                  <i className="h-2.5 w-2.5 rounded-full bg-[var(--public-border)]" />
                </span>
                <span className="rounded-full bg-[var(--public-surface-muted)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--public-muted)]">Minh họa</span>
              </div>
              <div className="h-[17rem] p-4 sm:p-5">
                <p className="mb-3 text-sm font-semibold">{STEPS[active].title}</p>
                <MockScreen key={`${active}-${manualPause}`} step={active} />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/dat-lich" className="public-button-primary inline-flex min-h-12 items-center gap-2 rounded-lg px-6 text-base font-semibold">
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                Đặt lịch khám
              </Link>
              <Link href="/huong-dan/dat-lich" className="text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4 sm:hidden">Xem hướng dẫn chi tiết</Link>
            </div>
          </div>

          <aside aria-labelledby="manage-title" className="flex flex-col rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5 sm:p-6">
            <h3 id="manage-title" className="text-base font-semibold">Sau khi đặt lịch</h3>
            <p className="mt-1 text-sm text-[var(--public-muted)]">Đăng nhập bằng email đã đặt lịch, mã OTP gửi về email.</p>
            <ul className="mt-4 space-y-3">
              {MANAGE_ITEMS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  {text}
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-[var(--public-divider)] pt-4">
              <p className="text-xs font-medium text-[var(--public-muted)]">Tiến trình một lịch hẹn</p>
              <ol key={`${tracking}-${manualPause}`} className="mt-2 grid grid-cols-4 gap-1.5" aria-label="Các trạng thái của lịch hẹn">
                {TRACK_STATUSES.map((status, index) => (
                  <li
                    key={status}
                    className={`flex min-h-10 items-center justify-center rounded-lg px-1 text-center text-[11px] font-medium leading-tight ${index === 0 || tracking ? "bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]" : "bg-[var(--public-surface-muted)] text-[var(--public-muted)]"} ${tracking && index > 0 ? "proc-lit" : ""}`}
                    style={tracking && index > 0 ? { animationDelay: `${0.8 + index * 1.2}s` } : undefined}
                  >
                    {status}
                  </li>
                ))}
              </ol>
            </div>

            <Link href="/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen" className="public-button-secondary mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold lg:mt-auto">
              <CalendarSearch className="h-5 w-5" aria-hidden="true" />
              Tra cứu lịch hẹn
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}

