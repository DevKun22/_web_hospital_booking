"use client";

import { ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, Search, ShieldCheck, Stethoscope } from "lucide-react";
import Link from "next/link";
import { PublicPageHero } from "@/components/public/public-page-layout";
import { absoluteUrl, jsonLdString } from "@/lib/seo";

const steps = [
  {
    title: "Chọn chuyên khoa",
    text: "Bắt đầu từ nhu cầu khám hoặc triệu chứng. Bạn có thể xem danh sách chuyên khoa trước khi đặt lịch.",
    icon: <Stethoscope className="h-5 w-5" />,
    href: "/departments",
    action: "Xem chuyên khoa",
  },
  {
    title: "Chọn bác sĩ hoặc gói khám",
    text: "Nếu đã biết bác sĩ, chọn bác sĩ để xem lịch trống. Nếu muốn rõ chi phí, chọn gói khám phù hợp.",
    icon: <ClipboardList className="h-5 w-5" />,
    href: "/bac-si",
    action: "Xem bác sĩ",
  },
  {
    title: "Chọn ngày và khung giờ",
    text: "Form đặt lịch sẽ hiển thị slot trống theo bác sĩ và ngày khám. Slot đã qua hoặc đã được đặt sẽ không hiển thị.",
    icon: <CalendarCheck className="h-5 w-5" />,
    href: "/#booking",
    action: "Đặt lịch",
  },
  {
    title: "Nhập thông tin người bệnh",
    text: "Thông tin bắt buộc gồm họ tên, số điện thoại, kênh OTP và lý do khám. Thông tin bổ sung có thể nhập khi cần.",
    icon: <CheckCircle2 className="h-5 w-5" />,
    href: "/#booking",
    action: "Mở form",
  },
  {
    title: "Xác thực OTP",
    text: "Sau khi tạo lịch, hệ thống gửi OTP qua SMS hoặc email. Xác thực thành công thì lịch chuyển sang trạng thái chờ xác nhận.",
    icon: <ShieldCheck className="h-5 w-5" />,
    href: "/appointments/lookup",
    action: "Tra cứu lịch",
  },
  {
    title: "Theo dõi trạng thái",
    text: "Dùng mã lịch và số điện thoại để tra cứu. Nếu quên mã lịch, xác thực OTP bằng số điện thoại để xem lịch gần đây.",
    icon: <Search className="h-5 w-5" />,
    href: "/appointments/lookup",
    action: "Tra cứu ngay",
  },
];

export default function BookingGuidePage() {
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cách đặt lịch khám trực tuyến",
    description: "Các bước chọn dịch vụ, nhập thông tin, xác thực OTP và theo dõi lịch hẹn.",
    inLanguage: "vi-VN",
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.text,
      url: absoluteUrl(`/guide/booking#step-${index + 1}`),
    })),
  };

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(howToJsonLd) }} />
      <PublicPageHero
        eyebrow="Hướng dẫn đặt lịch"
        title="Từ chọn chuyên khoa đến tra cứu trạng thái"
        description="Quy trình đặt lịch được thiết kế để người bệnh có thể chọn đúng dịch vụ, xác thực OTP và theo dõi lịch hẹn sau khi gửi yêu cầu."
      />

      <section className="ui-container py-10 sm:py-12">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {steps.map((step, index) => (
            <article id={`step-${index + 1}`} key={step.title} className="ui-lift-card flex h-full flex-col rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
                  {step.icon}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">Bước {index + 1}</p>
                  <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--public-muted)]">{step.text}</p>
              <Link href={step.href} className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-[var(--public-primary)]">
                {step.action}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <h2 className="text-xl font-semibold">Sẵn sàng đặt lịch?</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">
              Bạn có thể bắt đầu ngay từ form đặt lịch hoặc xem thêm câu hỏi thường gặp nếu cần giải thích chi tiết hơn.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/#booking" className="public-button-primary inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold">
              Bắt đầu đặt lịch
            </Link>
            <Link href="/faqs" className="public-button-secondary inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold">
              Xem FAQ
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
