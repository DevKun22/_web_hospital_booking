"use client";

import Link from "next/link";
import { PublicPageHero } from "@/components/public/public-page-layout";
import { absoluteUrl, jsonLdString } from "@/lib/seo";

const steps = [
  {
    title: "Chọn chuyên khoa",
    text: "Bắt đầu từ nhu cầu khám hoặc triệu chứng. Bạn có thể xem danh sách chuyên khoa trước khi đặt lịch.",
    href: "/chuyen-khoa",
    action: "Xem chuyên khoa",
  },
  {
    title: "Chọn bác sĩ hoặc gói khám",
    text: "Nếu đã biết bác sĩ, chọn bác sĩ để xem lịch trống. Nếu muốn rõ chi phí, chọn gói khám phù hợp.",
    href: "/bac-si",
    action: "Xem bác sĩ",
  },
  {
    title: "Chọn ngày và khung giờ",
    text: "Form đặt lịch sẽ hiển thị slot trống theo bác sĩ và ngày khám. Slot đã qua hoặc đã được đặt sẽ không hiển thị.",
    href: "/dat-lich",
    action: "Đặt lịch",
  },
  {
    title: "Nhập thông tin người khám",
    text: "Thông tin bắt buộc gồm họ tên, số điện thoại, kênh OTP và lý do khám. Thông tin bổ sung có thể nhập khi cần.",
    href: "/dat-lich",
    action: "Mở form",
  },
  {
    title: "Xác thực OTP",
    text: "Sau khi tạo lịch, hệ thống gửi OTP qua SMS hoặc email. Xác thực thành công thì lịch chuyển sang trạng thái chờ xác nhận.",
    href: "/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen",
    action: "Tra cứu lịch",
  },
  {
    title: "Theo dõi trạng thái",
    text: "Dùng mã lịch và số điện thoại để tra cứu. Nếu quên mã lịch, xác thực OTP bằng số điện thoại để xem lịch gần đây.",
    href: "/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen",
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
      url: absoluteUrl(`/huong-dan/dat-lich#step-${index + 1}`),
    })),
  };

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(howToJsonLd) }} />
      <PublicPageHero
        eyebrow="Hướng dẫn đặt lịch"
        title="Từ chọn chuyên khoa đến tra cứu trạng thái"
        description="Quy trình đặt lịch được thiết kế để người khám có thể chọn đúng dịch vụ, xác thực OTP và theo dõi lịch hẹn sau khi gửi yêu cầu."
      />

      <section className="ui-container py-6 sm:py-8">
        <ol className="max-w-3xl divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
          {steps.map((step, index) => (
            <li id={`step-${index + 1}`} key={step.title} className="flex gap-4 p-4 sm:p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--public-primary-soft)] text-sm font-bold text-[var(--public-primary-dark)]" aria-hidden="true">{index + 1}</span>
              <div className="min-w-0">
                <h2 className="text-base font-bold">{step.title}</h2>
                <p className="mt-1 text-base leading-7 text-[var(--public-text-soft)]">{step.text}</p>
                <Link href={step.href} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">{step.action}</Link>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex max-w-3xl flex-col gap-2 sm:flex-row">
          <Link href="/dat-lich" className="public-button-primary inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-base font-semibold">Bắt đầu đặt lịch</Link>
          <Link href="/ho-tro" className="public-button-secondary inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-base font-semibold">Trung tâm hỗ trợ</Link>
        </div>
      </section>
    </main>
  );
}
