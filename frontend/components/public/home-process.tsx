"use client";

import { CalendarSearch, ClipboardList, ShieldCheck, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// Mục quy trình ở trang chủ: bốn bước đặt lịch, sáng lên nối tiếp một lần khi mục hiện vào màn hình (đường nối chạy từ bước này sang bước sau).
// Không lặp vô hạn nên không cần nút dừng; không có JavaScript hoặc bật giảm chuyển động thì hiện sẵn đủ bốn bước.

const STEP_GAP_S = 0.85;

const STEPS = [
  { title: "Chọn dịch vụ", text: "Chuyên khoa, bác sĩ hoặc gói khám phù hợp với nhu cầu.", href: "/chuyen-khoa", link: "Xem chuyên khoa", icon: Stethoscope },
  { title: "Chọn giờ trống", text: "Xem ngày và giờ còn tiếp nhận, chi phí dự kiến hiển thị trước.", href: "/dat-lich", link: "Xem giờ trống", icon: CalendarSearch },
  { title: "Điền thông tin", text: "Họ tên, email và số điện thoại liên hệ, không cần tạo tài khoản.", href: "/dat-lich", link: "Mở biểu mẫu", icon: ClipboardList },
  { title: "Xác thực OTP", text: "Nhập mã gửi về email để xác nhận và nhận mã lịch hẹn.", href: "/huong-dan/dat-lich", link: "Xem hướng dẫn", icon: ShieldCheck },
] as const;

type Phase = "idle" | "armed" | "play";

const delayStyle = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export function HomeProcess({ title = "Đặt lịch trong 4 bước" }: { title?: string }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Chuẩn bị (ẩn bước) rồi chỉ chạy khi mục thật sự hiện vào màn hình; đã chạy một lần thì thôi.
    const armTimer = window.setTimeout(() => setPhase("armed"), 0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setPhase("play");
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      window.clearTimeout(armTimer);
      observer.disconnect();
    };
  }, []);

  return (
    <section id="quy-trinh" ref={sectionRef} data-proc={phase} aria-labelledby="process-title" className="scroll-mt-24 bg-[var(--public-canvas)]">
      <div className="ui-container py-10 sm:py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="process-title" className="text-xl font-semibold sm:text-2xl">{title}</h2>
            <span aria-hidden="true" className="mt-2 block h-[3px] w-10 rounded bg-[var(--public-care-mint)]" />
            <p className="mt-2 text-base text-[var(--public-muted)]">Không cần tạo tài khoản, xác nhận bằng mã OTP gửi về email.</p>
          </div>
          <Link href="/huong-dan/dat-lich" className="hidden shrink-0 py-2 text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4 sm:block">Xem hướng dẫn chi tiết</Link>
        </div>

        <ol className="mt-8 grid gap-6 md:grid-cols-4 md:gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const delay = index * STEP_GAP_S;
            const lineDelay = delay + 0.35;
            return (
              <li key={step.title} className="relative flex gap-4 md:flex-col md:gap-0">
                {index < STEPS.length - 1 ? (
                  <>
                    <span aria-hidden="true" className="absolute left-6 top-14 h-[calc(100%-2rem)] w-0.5 bg-[var(--public-border)] md:hidden">
                      <span className="proc-fill-y block h-full w-full bg-[var(--public-primary)]" style={delayStyle(lineDelay)} />
                    </span>
                    <span aria-hidden="true" className="absolute left-16 top-6 hidden h-0.5 w-[calc(100%-3rem)] bg-[var(--public-border)] md:block">
                      <span className="proc-fill-x block h-full w-full bg-[var(--public-primary)]" style={delayStyle(lineDelay)} />
                    </span>
                  </>
                ) : null}
                <span
                  aria-hidden="true"
                  className="proc-node relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--public-solid)] text-white shadow-[0_0_0_4px_var(--public-canvas)]"
                  style={delayStyle(delay)}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="proc-text min-w-0 md:mt-4" style={delayStyle(delay)}>
                  <h3 className="text-base font-semibold text-[var(--public-ink)]">
                    <span className="mr-1.5 tabular-nums text-[var(--public-primary)]">{index + 1}.</span>
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{step.text}</p>
                  <Link href={step.href} className="mt-1 inline-flex min-h-10 items-center text-sm font-medium text-[var(--public-primary)] underline-offset-4 hover:underline">{step.link}</Link>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
