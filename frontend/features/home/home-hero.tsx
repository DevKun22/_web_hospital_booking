import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock } from "lucide-react";
import { HomeHeroAskKun } from "@/components/public/home-hero-ask-kun";
import { HomeHeroSlider } from "@/components/public/home-hero-slider";
import { PublicGlobalSearch } from "@/components/public/public-global-search";
import type { PublicHomeData } from "@/components/public/public-home-types";
import { doctorDisplayName } from "@/lib/doctor";
import { formatShortDate } from "@/lib/format";
import type { DoctorProfile } from "@/lib/types";

const formatTime = (value: string) => value.slice(0, 5);
const MAX_CHIPS = 4;
const MAX_FALLBACK_DOCTORS = 3;

const rise = (index: number) => ({ "--i": index }) as CSSProperties;

// Sóng lặp theo chu kỳ 2 * half, và chu kỳ phải là ước của 1200 để lớp sóng rộng gấp đôi trôi nửa chiều rộng rồi nối liền không thấy mối.
function wavePath(half: number, base: number, amp: number) {
  let d = `M0 ${base} Q${half / 2} ${base - amp} ${half} ${base}`;
  for (let x = half * 2; x <= 2400; x += half) d += ` T${x} ${base}`;
  return `${d} V56 H0Z`;
}
const WAVE_A = wavePath(300, 34, 22);
const WAVE_B = wavePath(200, 30, 16);
const WAVE_TOP_A = wavePath(200, 34, 16);
const WAVE_TOP_B = wavePath(300, 30, 12);

// Thẻ bên phải hero khi quản trị chưa cấu hình banner: số liệu và bác sĩ có giờ gần nhất lấy từ dữ liệu thật, không dùng ảnh hay con số dựng sẵn.
function TodayCard({ doctors }: { doctors: DoctorProfile[] }) {
  const withToday = doctors.filter((doctor) => doctor.todayAvailableSlots?.length);
  const totalToday = withToday.reduce((sum, doctor) => sum + (doctor.todayAvailableSlots?.length || 0), 0);
  const picks = (withToday.length ? withToday : doctors.filter((doctor) => doctor.nextAvailableSlot)).slice(0, MAX_FALLBACK_DOCTORS);

  return (
    <section aria-labelledby="hero-today-title" className="rounded-2xl bg-[var(--public-surface)] p-5 text-[var(--public-ink)] shadow-2xl ring-1 ring-white/30 sm:p-6">
      <h2 id="hero-today-title" className="text-lg font-semibold">
        {totalToday ? `Hôm nay còn ${totalToday} giờ trống` : "Giờ khám gần nhất"}
      </h2>
      <p className="mt-1 text-sm text-[var(--public-muted)]">Chọn giờ, xác nhận bằng OTP, không cần tạo tài khoản.</p>
      {picks.length ? (
        <ul className="mt-4 divide-y divide-[var(--public-divider)]">
          {picks.map((doctor) => {
            const slot = doctor.todayAvailableSlots?.[0];
            const next = doctor.nextAvailableSlot;
            const href = slot
              ? `/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}&timeSlotId=${slot.id}`
              : `/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}${next ? `&date=${next.date.slice(0, 10)}&timeSlotId=${next.id}` : ""}`;
            return (
              <li key={doctor.id}>
                <Link href={href} className="flex min-h-14 items-center justify-between gap-3 py-2.5 hover:text-[var(--public-primary)]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{doctorDisplayName(doctor)}</span>
                    <span className="block truncate text-sm text-[var(--public-muted)]">{doctor.department.name}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--public-surface-muted)] px-2.5 py-1 text-sm font-semibold tabular-nums">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {slot ? formatTime(slot.startTime) : next ? `${formatTime(next.startTime)}, ${formatShortDate(next.date)}` : "Đặt lịch"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-4 space-y-1">
          {[
            { href: "/bac-si", label: "Tìm bác sĩ theo tên hoặc chuyên khoa" },
            { href: "/goi-kham", label: "Xem gói khám và chi phí dự kiến" },
            { href: "/chuyen-khoa", label: "Chọn chuyên khoa theo nhu cầu" },
          ].map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 text-sm font-medium hover:bg-[var(--public-surface-muted)]">
                {item.label}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/dat-lich" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--public-primary)] underline-offset-4 hover:underline">
        Xem tất cả giờ trống
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

// Hero trang chủ: nền gradient màu thương hiệu; bên trái tiêu ngữ, ô tìm kiếm, gợi ý chuyên khoa và hai nút; bên phải trình chiếu banner (hoặc thẻ giờ trống).
export function HomeHero({ data, waveFill = "var(--public-canvas)" }: { data: Pick<PublicHomeData, "departments" | "doctors" | "heroBanners">; waveFill?: string }) {
  const chips = data.departments.filter((item) => item.slug).slice(0, MAX_CHIPS);
  return (
    <section
      aria-labelledby="home-title"
      className="relative z-10 bg-[radial-gradient(60rem_28rem_at_88%_-12%,rgba(255,255,255,0.16),transparent),linear-gradient(120deg,var(--hero-from)_0%,var(--hero-via)_58%,var(--hero-to)_100%)] text-white"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg aria-hidden="true" className="hero-wave-top hero-wave-top--b" viewBox="0 0 2400 56" preserveAspectRatio="none"><path d={WAVE_TOP_B} style={{ fill: "var(--public-surface)" }} /></svg>
        <svg aria-hidden="true" className="hero-wave-top hero-wave-top--a" viewBox="0 0 2400 56" preserveAspectRatio="none"><path d={WAVE_TOP_A} style={{ fill: "var(--public-surface)" }} /></svg>
        <span aria-hidden="true" className="hero-blob -left-24 -top-32 h-96 w-96 opacity-40" />
        <span aria-hidden="true" className="hero-blob -right-20 top-1/3 h-80 w-80 opacity-30 [animation-delay:-6s] [animation-direction:reverse]" />
        <svg aria-hidden="true" className="hero-wave hero-wave--b" viewBox="0 0 2400 56" preserveAspectRatio="none"><path d={WAVE_B} style={{ fill: waveFill }} /></svg>
        <svg aria-hidden="true" className="hero-wave hero-wave--a" viewBox="0 0 2400 56" preserveAspectRatio="none"><path d={WAVE_A} style={{ fill: waveFill }} /></svg>
      </div>
      <div className="ui-container relative z-10 grid grid-cols-[minmax(0,1fr)] items-center gap-8 pb-16 pt-10 sm:pb-20 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12 lg:pb-24 lg:pt-16">
        <div>
          <h1 id="home-title" className="text-[1.75rem] font-semibold leading-tight text-white sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]">
            Đặt lịch khám bệnh trực tuyến, biết giờ trống và chi phí trước khi đến
          </h1>
          <p className="hero-rise mt-3 max-w-xl text-base leading-7 text-white/90 sm:text-lg" style={rise(0)}>
            Chọn bác sĩ và giờ khám còn trống, xác nhận bằng mã OTP. Quý khách không cần tạo tài khoản.
          </p>

          <div className="hero-rise relative z-20 mt-6 max-w-xl" style={rise(1)}>
            <PublicGlobalSearch large />
            {chips.length ? (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/90">
                <span>Gợi ý:</span>
                {chips.map((item) => (
                  <Link key={item.id} href={`/chuyen-khoa/${item.slug}`} className="rounded-full border border-white/40 px-3 py-1 transition hover:bg-white/15">
                    {item.name}
                  </Link>
                ))}
              </p>
            ) : null}
          </div>

          <div className="hero-rise mt-6 flex flex-col gap-3 sm:flex-row" style={rise(2)}>
            <Link href="/dat-lich" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--hero-btn-bg)] px-6 text-base font-semibold text-[var(--hero-btn-fg)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              Đặt lịch khám
            </Link>
            <HomeHeroAskKun />
          </div>
        </div>

        <div className="hero-rise" style={rise(3)}>
          {data.heroBanners.length ? <HomeHeroSlider banners={data.heroBanners} /> : <TodayCard doctors={data.doctors} />}
        </div>
      </div>
    </section>
  );
}
