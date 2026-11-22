"use client";

import { CalendarSearch, ClipboardList, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// Mục quy trình ở trang chủ: năm bước (bốn bước đặt lịch và bước tùy chọn vào cổng thông tin), sáng lên nối tiếp khi mục hiện vào màn hình, sau đó một vệt sáng chạy nối các bước và lặp lại.
// Chạy tự động; không có JavaScript hoặc bật giảm chuyển động thì hiện sẵn đủ năm bước, không lặp.

const STEP_GAP_S = 0.85;
// Vệt sáng bắt đầu sau khi các bước hiện xong; mỗi chặng 1,4 giây gồm 0,9 giây chạy và 0,5 giây nghỉ ở nút (chu kỳ 8 giây, xem globals.css).
const LOOP_START_S = 4.6;
const HOP_S = 1.4;

const STEPS = [
  { title: "Chọn dịch vụ", text: "Chuyên khoa, bác sĩ hoặc gói khám phù hợp với nhu cầu.", href: "/chuyen-khoa", link: "Xem chuyên khoa", icon: Stethoscope },
  { title: "Chọn giờ trống", text: "Xem ngày và giờ còn tiếp nhận, chi phí dự kiến hiển thị trước.", href: "/dat-lich", link: "Xem giờ trống", icon: CalendarSearch },
  { title: "Điền thông tin", text: "Họ tên, email và số điện thoại liên hệ, không cần tạo tài khoản.", href: "/dat-lich", link: "Mở biểu mẫu", icon: ClipboardList },
  { title: "Xác thực OTP", text: "Nhập mã gửi về email để xác nhận và nhận mã lịch hẹn.", href: "/huong-dan/dat-lich", link: "Xem hướng dẫn", icon: ShieldCheck },
  { title: "Cổng thông tin", text: "Đăng nhập bằng email để theo dõi lịch hẹn, hóa đơn, hồ sơ và đặt lịch cho người thân.", href: "/tai-khoan/dang-nhap", link: "Mở cổng thông tin", icon: UserRound, optional: true },
] as const;

type Phase = "idle" | "armed" | "play";

const delayStyle = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export function HomeProcess({ title = "Đặt lịch trong 5 bước" }: { title?: string }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Tải lại giữa trang: mục đã nằm sẵn trong màn hình thì chạy ngay, không ẩn rồi chờ (trước đây bộ quan sát có thể báo trước khi bước "chuẩn bị" chạy,
    // khiến mục kẹt ở trạng thái ẩn).
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.6 && rect.bottom > 0) {
      const playTimer = window.setTimeout(() => setPhase("play"), 0);
      return () => window.clearTimeout(playTimer);
    }
    // Chuẩn bị (ẩn bước) rồi chỉ chạy khi mục thật sự hiện vào màn hình; đã chạy một lần thì thôi. Bước chuẩn bị không được ghi đè trạng thái đã chạy.
    const armTimer = window.setTimeout(() => setPhase((current) => (current === "idle" ? "armed" : current)), 0);
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
        <div className="text-center">
          <h2 id="process-title" className="text-xl font-semibold sm:text-2xl">{title}</h2>
          <span aria-hidden="true" className="mx-auto mt-2 block h-[3px] w-10 rounded bg-[var(--public-care-mint)]" />
          <p className="mx-auto mt-2 max-w-xl text-base text-[var(--public-muted)]">Không cần tạo tài khoản để đặt lịch, xác nhận bằng mã OTP gửi về email.</p>
          <Link href="/huong-dan/dat-lich" className="mt-1 inline-flex min-h-10 items-center text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">Xem hướng dẫn chi tiết</Link>
        </div>

        <ol className="mt-8 grid gap-6 md:grid-cols-5 md:gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const optional = "optional" in step;
            const delay = index * STEP_GAP_S;
            const lineDelay = delay + 0.35;
            const flowStyle = { "--f": `${LOOP_START_S + 0.5 + HOP_S * index}s` } as CSSProperties;
            const nodeStyle = { "--d": `${delay}s`, "--r": `${LOOP_START_S + HOP_S * index}s` } as CSSProperties;
            return (
              <li key={step.title} className="relative flex gap-4 md:flex-col md:items-center md:gap-0 md:text-center">
                {index < STEPS.length - 1 ? (
                  <>
                    <span aria-hidden="true" className="absolute left-6 top-14 h-[calc(100%-2rem)] w-0.5 overflow-hidden bg-[var(--public-border)] md:hidden">
                      <span className="proc-fill-y block h-full w-full bg-[var(--public-primary)]" style={delayStyle(lineDelay)} />
                      <span className="proc-flow-y absolute left-0 top-0 h-2/5 w-full" style={flowStyle} />
                    </span>
                    <span aria-hidden="true" className="absolute left-[calc(50%+1.75rem)] top-6 hidden h-0.5 w-[calc(100%-2.5rem)] overflow-hidden bg-[var(--public-border)] md:block">
                      <span className="proc-fill-x block h-full w-full bg-[var(--public-primary)]" style={delayStyle(lineDelay)} />
                      <span className="proc-flow-x absolute left-0 top-0 h-full w-2/5" style={flowStyle} />
                    </span>
                  </>
                ) : null}
                <span
                  aria-hidden="true"
                  className={`proc-node relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-[0_0_0_4px_var(--public-canvas)] ${optional ? "border-2 border-dashed border-[var(--public-primary)] bg-[var(--public-canvas)] text-[var(--public-primary)]" : "bg-[var(--public-solid)] text-white"}`}
                  style={nodeStyle}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="proc-text min-w-0 md:mt-4 md:flex md:flex-col md:items-center" style={delayStyle(delay)}>
                  <h3 className="text-base font-semibold text-[var(--public-ink)]">
                    <span className="mr-1.5 tabular-nums text-[var(--public-primary)]">{index + 1}.</span>
                    {step.title}
                  </h3>
                  {optional ? <span className="mt-0.5 inline-block rounded-full border border-dashed border-[var(--public-primary)] px-2 text-xs text-[var(--public-primary-dark)]">Không bắt buộc</span> : null}
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
