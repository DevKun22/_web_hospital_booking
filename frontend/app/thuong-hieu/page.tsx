import type { Metadata } from "next";
import { BrandLoader } from "@/components/branding/brand-loader";
import { BrandLogo } from "@/components/branding/brand-logo";

export const metadata: Metadata = {
  title: "Bộ nhận diện",
  robots: { index: false, follow: false },
};

const swatches = [
  { name: "Xanh dương", token: "--dk-blue", note: "Chữ và nút chính, 7,6:1 trên nền trắng" },
  { name: "Teal đậm", token: "--dk-teal-ink", note: "Chữ nhấn, 4,9:1 trên nền trắng" },
  { name: "Teal", token: "--dk-teal", note: "Trang trí, không dùng cho chữ (2,8:1)" },
  { name: "Xanh lá đậm", token: "--dk-green-ink", note: "Chữ trạng thái hoàn tất, 5,3:1" },
  { name: "Xanh lá", token: "--dk-green", note: "Biểu tượng kèm nhãn, không dùng cho chữ (2,2:1)" },
] as const;

// Trang xem thử bộ nhận diện để duyệt trước khi dùng rộng; không có trong điều hướng và không được lập chỉ mục.
export default function BrandPreviewPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 text-[var(--dk-ink)]">
      <h1 className="text-3xl font-bold">Bộ nhận diện DevKunCare</h1>

      <section aria-labelledby="logo-heading" className="grid gap-6 md:grid-cols-2">
        <h2 id="logo-heading" className="sr-only">Logo</h2>
        <figure className="rounded-2xl border border-slate-200 bg-white p-6">
          <BrandLogo variant="full" size="lg" />
          <figcaption className="mt-3 text-sm text-slate-600">logo-full: trang đăng nhập, giới thiệu</figcaption>
        </figure>
        <figure className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <BrandLogo variant="horizontal" size="lg" />
          <BrandLogo variant="horizontal" size="md" />
          <BrandLogo variant="horizontal" size="sm" />
          <figcaption className="text-sm text-slate-600">logo-horizontal: thanh đầu trang (không kèm khẩu hiệu)</figcaption>
        </figure>
        <figure className="rounded-2xl bg-[#0b2a4a] p-6">
          <BrandLogo variant="light" size="lg" />
          <figcaption className="mt-3 text-sm text-slate-200">logo-light: nền tối</figcaption>
        </figure>
        <figure className="flex flex-wrap items-end gap-6 rounded-2xl border border-slate-200 bg-white p-6">
          <BrandLogo variant="icon" size="lg" />
          <BrandLogo variant="icon" size="md" />
          <BrandLogo variant="icon" size="sm" />
          <figcaption className="basis-full text-sm text-slate-600">logo-icon: thanh bên thu gọn, màn hình tải</figcaption>
        </figure>
      </section>

      <section aria-labelledby="loader-heading" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 id="loader-heading" className="text-xl font-bold">Tải toàn trang</h2>
        <div className="mt-2 flex flex-wrap gap-10">
          <BrandLoader size="sm" label="Đang tải..." />
          <BrandLoader size="md" label="Đang tải lịch khám..." />
          <BrandLoader size="lg" label="Đang xử lý..." />
        </div>
        <p className="text-sm text-slate-600">Khi bật giảm chuyển động, vòng quay và nhịp thở của logo dừng lại, chỉ còn chữ trạng thái.</p>
      </section>

      <section aria-labelledby="color-heading" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 id="color-heading" className="text-xl font-bold">Màu</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {swatches.map((item) => (
            <li key={item.token} className="flex items-center gap-3">
              <span className="h-12 w-12 shrink-0 rounded-xl border border-slate-200" style={{ background: `var(${item.token})` }} aria-hidden="true" />
              <span className="text-sm"><strong className="block">{item.name}</strong><span className="text-slate-600">{item.note}</span></span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
