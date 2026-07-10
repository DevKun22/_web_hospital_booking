"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  HelpCircle,
  HeartPulse,
  Hospital,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  X,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { BackToTopButton } from "@/components/public/back-to-top-button";
import { PublicConsultationRequest } from "@/components/public/public-consultation-request";
import { PublicGlobalSearch } from "@/components/public/public-global-search";
import { IdleMount, LazyMount } from "@/components/public/lazy-mount";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { usePublicSearchSuggestions } from "@/lib/public-search-query";
import {
  closePublicConsultation,
  openPublicConsultation,
} from "@/lib/public-ui-events";
import type { Banner, DoctorProfile } from "@/lib/types";
import type { PublicHomeData } from "./public-home-types";

type PublicHomeViewProps = {
  data: PublicHomeData;
  loading: boolean;
  error: string;
};

const PublicBookingWidget = dynamic(() =>
  import("@/components/public/public-booking-widget").then(
    (module) => module.PublicBookingWidget,
  ),
);

const PublicChatbotWidget = dynamic(
  () =>
    import("@/components/public/public-chatbot-widget").then(
      (module) => module.PublicChatbotWidget,
    ),
  { ssr: false },
);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);

const doctorName = (doctor: DoctorProfile) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const firstLetter = (value: string) =>
  value.trim().slice(0, 1).toUpperCase() || "H";

const faqCategoryMeta = {
  booking: {
    label: "Đặt lịch",
    description: "Chọn chuyên khoa, bác sĩ, ngày khám và xác thực OTP.",
  },
  payment: {
    label: "Thanh toán",
    description: "Chi phí khám, hóa đơn, trạng thái thanh toán và hoàn tiền.",
  },
  doctor: {
    label: "Bác sĩ",
    description: "Thông tin chuyên môn, lịch khám và cách chọn bác sĩ phù hợp.",
  },
  insurance: {
    label: "BHYT",
    description: "Bảo hiểm y tế và các thông tin cần chuẩn bị trước khi khám.",
  },
  general: {
    label: "Chung",
    description: "Thông tin chung khi sử dụng dịch vụ đặt lịch trực tuyến.",
  },
} as const;

const faqCategoryOrder = [
  "booking",
  "payment",
  "doctor",
  "insurance",
  "general",
] as const;

export function PublicHomeView({ data, loading, error }: PublicHomeViewProps) {
  const hospitalName =
    data.settings?.hospitalName?.trim() || "Hospital Booking";
  const logo = data.settings?.logo?.trim();
  const hotline =
    data.settings?.hotline?.trim() ||
    data.settings?.emergencyHotline?.trim() ||
    "1900 0000";
  const promoBanner = data.promoBanners[0];
  const popularPackages = data.packages
    .filter((item) => item.isPopular)
    .slice(0, 3);
  const visiblePackages = (
    popularPackages.length ? popularPackages : data.packages
  ).slice(0, 3);

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#172033]">
      <PublicHeader hospitalName={hospitalName} logo={logo} hotline={hotline} />
      <PublicSearchRail />

      {error ? (
        <section className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-4 py-3 text-sm text-[#b3261e]">
            {error}
          </div>
        </section>
      ) : null}

      <HeroSection
        hospitalName={hospitalName}
        hotline={hotline}
        heroBanners={data.heroBanners}
        promoBanner={promoBanner}
        loading={loading}
        counts={{
          departments: data.departments.length,
          doctors: data.doctors.length,
          packages: data.packages.length,
        }}
      />

      <LazyMount
        fallback={
          <section id="booking" className="ui-container scroll-mt-24 py-12 sm:py-16">
            <div className="skeleton-shimmer h-[420px] rounded-xl border border-[var(--border)]" aria-label="Đang chuẩn bị form đặt lịch" />
          </section>
        }
      >
        <PublicBookingWidget data={data} loading={loading} />
      </LazyMount>
      <PublicConsultationRequest />
      <DepartmentSection
        departments={data.departments.slice(0, 6)}
        loading={loading}
      />
      <DoctorSection doctors={data.doctors.slice(0, 4)} loading={loading} />
      <PackageSection packages={visiblePackages} loading={loading} />
      <FaqTopicSection faqs={data.faqs.slice(0, 5)} loading={loading} />
      <PublicFooter
        settings={data.settings}
        hospitalName={hospitalName}
        logo={logo}
        hotline={hotline}
        loading={loading}
      />
      <PublicSocialDock
        settings={data.settings}
        hotline={hotline}
        loading={loading}
      />
      <BackToTopButton />
      <IdleMount>
        <PublicChatbotWidget />
      </IdleMount>
    </main>
  );
}

function PublicHeader({
  hospitalName,
  logo,
  hotline,
}: {
  hospitalName: string;
  logo?: string;
  hotline: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);
  const navItems = [
    ["#departments", "Chuyên khoa"],
    ["#doctors", "Bác sĩ"],
    ["#packages", "Gói khám"],
    ["#consultation", "Tư vấn"],
    ["/appointments/lookup", "Tra cứu lịch"],
    ["/guide/booking", "Hướng dẫn"],
    ["/search", "Tìm kiếm"],
    ["/faqs", "Hỏi đáp"],
  ];
  const quickSearchKeywords = [
    "Tim mạch",
    "Tổng quát",
    "BHYT",
    "Thanh toán",
    "Quên mã lịch",
  ];

  const scrollToSection = useCallback((href: string) => {
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;

    const headerOffset = 88;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
    window.history.replaceState(null, "", href);
  }, []);

  const handleNavigation = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (href === "#consultation") {
      event.preventDefault();
      setMobileOpen(false);
      window.setTimeout(() => openPublicConsultation(), mobileOpen ? 140 : 0);
      return;
    }

    if (!href.startsWith("#")) return;
    event.preventDefault();
    closePublicConsultation();
    setMobileOpen(false);

    // On mobile, wait until the fixed menu is removed and body scrolling is restored.
    window.setTimeout(
      () => window.requestAnimationFrame(() => scrollToSection(href)),
      mobileOpen ? 140 : 0,
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur-xl">
      <div className="ui-container flex min-h-16 items-center justify-between gap-4 py-2">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            {logo ? (
              <Image
                src={logo}
                alt={hospitalName}
                fill
                sizes="44px"
                unoptimized
                className="object-contain p-1"
              />
            ) : (
              <Hospital className="h-6 w-6" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold">
              {hospitalName}
            </span>
            <span className="block truncate text-xs text-[#667892]">
              Đặt lịch khám nhanh chóng
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-[var(--text-soft)] xl:flex">
          {navItems.slice(0, 6).map(([href, label]) =>
            href.startsWith("/") ? (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--primary)]"
              >
                {label}
              </Link>
            ) : (
              <a
                key={href}
                href={href}
                onClick={(event) => handleNavigation(event, href)}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--primary)]"
              >
                {label}
              </a>
            ),
          )}
          {/* <Link href="/login" className="rounded-md px-3 py-2 hover:bg-[#f1f5f9]">Dashboard</Link> */}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={`tel:${hotline}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]"
          >
            <Phone className="h-4 w-4" />
            {hotline}
          </a>
          <a
            href="#booking"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--primary-hover)]"
          >
            Đặt lịch
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-soft)] lg:hidden"
          aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={mobileOpen}
          aria-controls="public-mobile-navigation"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>


      {mobileOpen ? (
        <nav id="public-mobile-navigation" className="fixed inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-[var(--border)] bg-white px-4 py-4 shadow-xl lg:hidden">
          {[...navItems, ["#booking", "Đặt lịch"]].map(([href, label]) =>
            href.startsWith("/") ? (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block min-h-11 rounded-lg px-3 py-3 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
              >
                {label}
              </Link>
            ) : (
              <a
                key={href}
                href={href}
                onClick={(event) => handleNavigation(event, href)}
                className="block min-h-11 rounded-lg px-3 py-3 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
              >
                {label}
              </a>
            ),
          )}
        </nav>
      ) : null}
    </header>
  );
}

function PublicSearchRail() {
  const defaultKeywords = [
    "Tim mạch",
    "Tổng quát",
    "BHYT",
    "Thanh toán",
    "Quên mã lịch",
  ];
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(
        () => setSuggestionsEnabled(true),
        { timeout: 3000 },
      );
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }
    const timeoutId = window.setTimeout(() => setSuggestionsEnabled(true), 1800);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const suggestionsQuery = usePublicSearchSuggestions(5, suggestionsEnabled);
  const quickSearchKeywords = suggestionsQuery.data?.items.length
    ? suggestionsQuery.data.items
    : defaultKeywords;

  return (
    <section className="relative z-30 border-b border-[#dce8f6] bg-[linear-gradient(180deg,#f4f9ff_0%,#eef6ff_100%)]">
      <div className="ui-container py-2.5 sm:py-3">
        <div className="grid gap-3 rounded-lg border border-white/90 bg-white/92 p-2.5 shadow-sm backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] md:items-center md:p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] sm:flex">
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#30c47c]" />
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold text-[#172033]">Tìm nhanh</p>
                <span className="hidden text-xs text-[#667892] sm:inline">
                  chuyên khoa, bác sĩ, gói khám và hướng dẫn tra cứu
                </span>
              </div>
              <div className="mt-1.5 flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                {quickSearchKeywords.map((keyword) => (
                  <Link
                    key={keyword}
                    href={`/search?q=${encodeURIComponent(keyword)}`}
                    className="shrink-0 rounded-full border border-[#d8e9ff] bg-[#f8fbff] px-2.5 py-1 text-xs font-semibold text-[#0d4f8b] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                  >
                    {keyword}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <PublicGlobalSearch compact />
        </div>
      </div>
    </section>
  );
}

function HeroSection({
  hospitalName,
  hotline,
  heroBanners,
  promoBanner,
  loading,
  counts,
}: {
  hospitalName: string;
  hotline: string;
  heroBanners: Banner[];
  promoBanner?: Banner;
  loading: boolean;
  counts: { departments: number; doctors: number; packages: number };
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const heroSlides = useMemo(
    () => (heroBanners.length ? heroBanners : promoBanner ? [promoBanner] : []),
    [heroBanners, promoBanner],
  );
  const activeBanner = heroSlides[selectedIndex] || heroSlides[0];
  const heroTitle = activeBanner?.title || hospitalName;
  const heroSubtitle = activeBanner?.subtitle;
  const hasMultipleSlides = heroSlides.length > 1;

  const updateSelectedSlide = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    window.requestAnimationFrame(updateSelectedSlide);
    emblaApi.on("select", updateSelectedSlide);
    emblaApi.on("reInit", updateSelectedSlide);

    return () => {
      emblaApi.off("select", updateSelectedSlide);
      emblaApi.off("reInit", updateSelectedSlide);
    };
  }, [emblaApi, updateSelectedSlide]);

  useEffect(() => {
    if (!emblaApi || !hasMultipleSlides) return;

    const timer = window.setInterval(() => {
      emblaApi.scrollNext();
    }, 5200);

    return () => window.clearInterval(timer);
  }, [emblaApi, hasMultipleSlides]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
    emblaApi.scrollTo(0);
  }, [emblaApi, heroSlides.length]);

  return (
    <section className="overflow-hidden bg-[linear-gradient(180deg,#f4f9ff_0%,#ffffff_72%,#f6f8fb_100%)]">
      <div className="ui-container grid items-center gap-8 py-10 sm:py-12 lg:min-h-[590px] lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)] lg:gap-10 lg:py-12">
        <ScrollReveal className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe4fa] bg-white px-3 py-1.5 text-xs font-semibold text-[#0d4f8b] shadow-sm sm:text-sm">
            <Sparkles className="h-4 w-4" />
            Đặt lịch khám nhanh, rõ chi phí và dễ tra cứu
          </div>
          {loading ? (
            <div className="mt-5 space-y-3">
              <Skeleton className="h-12 w-full max-w-xl" />
              <Skeleton className="h-12 w-4/5 max-w-lg" />
              <Skeleton className="mt-5 h-4 w-full max-w-xl" />
              <Skeleton className="h-4 w-11/12 max-w-xl" />
              <Skeleton className="h-4 w-2/3 max-w-md" />
            </div>
          ) : (
            <h1 className="mt-4 text-3xl font-semibold leading-[1.12] text-[#172033] sm:text-5xl lg:text-[3.25rem]">
              <span className="ui-accent-text">{heroTitle}</span>
            </h1>
          )}
          <p
            className={`mt-4 max-w-xl text-base leading-7 text-[#42526b] ${loading ? "hidden" : ""}`}
          >
            {heroSubtitle ||
              `Đặt lịch khám tại ${hospitalName} với quy trình rõ ràng: chọn chuyên khoa, bác sĩ, khung giờ còn trống và xác thực OTP để giữ lịch. Thông tin chi phí, trạng thái lịch hẹn và kết quả sau khám được theo dõi tập trung.`}
          </p>
          <div
            className={`mt-4 hidden flex-wrap gap-2 text-xs font-semibold text-[#42526b] sm:flex ${loading ? "sm:hidden" : ""}`}
          >
            {[
              "Xác thực OTP",
              "Theo dõi trạng thái",
              "Tra cứu hóa đơn",
              "Hỗ trợ tư vấn",
            ].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full border border-[#d8e9ff] bg-white px-3 py-1.5 shadow-sm"
              >
                <CheckCircle2
                  className="h-3.5 w-3.5 text-[#1f7a3a]"
                  aria-hidden="true"
                />
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="#booking"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(13,79,139,0.22)] transition hover:-translate-y-0.5 hover:bg-[var(--primary-hover)]"
            >
              Đặt lịch ngay
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={`tel:${hotline}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[#42526b] transition hover:-translate-y-0.5 hover:bg-[#f8fafc]"
            >
              <Phone className="h-4 w-4" />
              Gọi {hotline}
            </a>
          </div>
          <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["Chuyên khoa", counts.departments],
              ["Bác sĩ", counts.doctors],
              ["Gói khám", counts.packages],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-[#d8e9ff] bg-white p-3 shadow-sm sm:p-4"
              >
                {loading ? (
                  <Skeleton className="h-8 w-14" />
                ) : (
                  <p className="text-xl font-semibold text-[#0d4f8b] sm:text-2xl">
                    {value}
                  </p>
                )}
                <p className="mt-1 truncate text-xs text-[#667892] sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <div className="ui-soft-glow relative aspect-[4/3] min-h-0 overflow-hidden rounded-xl border border-[#cfe0f3] bg-[#e7f0fb] shadow-[0_24px_60px_rgba(13,79,139,0.16)] sm:aspect-[16/10] lg:min-h-[460px] lg:aspect-auto">
            {loading ? (
              <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            ) : heroSlides.length ? (
              <div ref={emblaRef} className="absolute inset-0 overflow-hidden">
                <div className="flex h-full touch-pan-y">
                  {heroSlides.map((slide, index) => {
                    const slideImage = slide.mobileImage || slide.image;

                    return (
                      <div
                        key={slide.id}
                        className="relative min-w-0 flex-[0_0_100%]"
                      >
                        {slideImage ? (
                          <Image
                            src={slideImage}
                            alt={slide.title || hospitalName}
                            fill
                            sizes="(min-width: 1024px) 50vw, 100vw"
                            priority={index === 0}
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-[linear-gradient(135deg,#e7f0fb_0%,#f0fff4_55%,#fff8eb_100%)]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#e7f0fb_0%,#f0fff4_55%,#fff8eb_100%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#061827]/82 via-[#0b2440]/22 to-[#ffffff]/5" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/35 to-transparent" />
            {!loading && hasMultipleSlides ? (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-3 right-3 z-10 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => emblaApi?.scrollPrev()}
                    className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[#172033] shadow-lg ring-1 ring-white/70 backdrop-blur transition hover:scale-105 hover:bg-white"
                    aria-label="Banner trước"
                    title="Banner trước"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => emblaApi?.scrollNext()}
                    className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[#172033] shadow-lg ring-1 ring-white/70 backdrop-blur transition hover:scale-105 hover:bg-white"
                    aria-label="Banner tiếp theo"
                    title="Banner tiếp theo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : null}
            <div className="absolute left-5 top-5 max-w-[78%] rounded-full border border-white/30 bg-white/18 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
              {hasMultipleSlides
                ? `${selectedIndex + 1}/${heroSlides.length}`
                : "Dịch vụ đặt lịch"}
            </div>
            <div className="absolute bottom-0 left-0 right-0 hidden p-5 text-white sm:block sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <HeroInfo
                  icon={<CalendarDays className="h-4 w-4" />}
                  title="Lịch hẹn"
                  text="Chọn ngày, bác sĩ và slot khám phù hợp."
                />
                <HeroInfo
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Minh bạch"
                  text="Hiển thị phí khám, gói khám và trạng thái xử lý."
                  tone="green"
                />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function HeroInfo({
  icon,
  title,
  text,
  tone = "blue",
}: {
  icon: ReactNode;
  title: string;
  text: string;
  tone?: "blue" | "green";
}) {
  return (
    <div className="ui-lift-card rounded-md bg-white/95 p-4 text-[#172033] shadow-lg">
      <div
        className={`flex items-center gap-2 text-sm font-semibold ${tone === "green" ? "text-[#1f7a3a]" : "text-[#0d4f8b]"}`}
      >
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm text-[#667892]">{text}</p>
    </div>
  );
}

function DepartmentSection({
  departments,
  loading,
}: {
  departments: PublicHomeData["departments"];
  loading: boolean;
}) {
  return (
    <section
      id="departments"
      className="ui-deferred-section mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8"
    >
      <SectionHeading
        eyebrow="Chuyên khoa"
        title="Chọn đúng nơi bắt đầu"
        action="Xem tất cả chuyên khoa"
        actionHref="/departments"
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <ScrollReveal key={index} delay={index * 70}>
              <DepartmentSkeletonCard />
            </ScrollReveal>
          ))
        ) : departments.length ? (
          departments.map((item, index) => (
            <ScrollReveal key={item.id} delay={index * 70}>
              <article className="ui-lift-card flex h-full min-h-[328px] flex-col overflow-hidden rounded-md border border-[#dce3ee] bg-white">
                <div className="relative h-36 shrink-0 bg-[#e7f0fb]">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#0d4f8b]">
                      <HeartPulse className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 min-h-12 font-semibold leading-6">
                    {item.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 min-h-[72px] text-sm leading-6 text-[#667892]">
                    {item.description ||
                      "Đội ngũ chuyên môn sẵn sàng tư vấn và tiếp nhận lịch khám."}
                  </p>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                    <Link
                      href={
                        item.slug
                          ? `/departments/${item.slug}`
                          : `/doctors?departmentId=${item.id}`
                      }
                      className="rounded-md border border-[#cfd8e6] px-3 py-2 text-center text-xs font-semibold text-[#42526b] hover:bg-[#f8fafc]"
                    >
                      Chi tiết
                    </Link>
                    <Link
                      href={`/?departmentId=${item.id}#booking`}
                      className="rounded-md bg-[#0d4f8b] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#083d6d]"
                    >
                      Đặt lịch
                    </Link>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))
        ) : (
          <EmptyState
            label={
              loading
                ? "Đang tải chuyên khoa..."
                : "Chưa có chuyên khoa hiển thị."
            }
          />
        )}
      </div>
    </section>
  );
}

function DoctorSection({
  doctors,
  loading,
}: {
  doctors: DoctorProfile[];
  loading: boolean;
}) {
  return (
    <section id="doctors" className="ui-deferred-section bg-white">
      <div className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Bác sĩ"
          title="Đội ngũ đang sẵn sàng tiếp nhận"
          action="Xem tất cả bác sĩ"
          actionHref="/doctors"
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <ScrollReveal key={index} delay={index * 70}>
                <DoctorSkeletonCard />
              </ScrollReveal>
            ))
          ) : doctors.length ? (
            doctors.map((doctor, index) => (
              <ScrollReveal key={doctor.id} delay={index * 70}>
                <article className="ui-lift-card rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4">
                  <div className="flex items-center gap-3">
                    {doctor.user.avatar ? (
                      <Image
                        src={doctor.user.avatar}
                        alt={doctor.user.fullName}
                        width={56}
                        height={56}
                        sizes="56px"
                        unoptimized
                        className="h-14 w-14 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#e7f0fb] text-lg font-semibold text-[#0d4f8b]">
                        {firstLetter(doctor.user.fullName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">
                        {doctorName(doctor)}
                      </h3>
                      <p className="truncate text-sm text-[#667892]">
                        {doctor.department.name}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-[#667892]">
                    <p className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-[#0d4f8b]" />
                      {doctor.specialization || "Khám chuyên khoa"}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#0d4f8b]" />
                      {doctor.experience || 0} năm kinh nghiệm
                    </p>
                  </div>
                  <p className="mt-4 font-semibold text-[#0d4f8b]">
                    {formatCurrency(doctor.consultationFee)}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`/doctors/${doctor.id}`}
                      className="rounded-md border border-[#cfd8e6] px-3 py-2 text-center text-xs font-semibold text-[#42526b] hover:bg-white"
                    >
                      Chi tiết
                    </Link>
                    <Link
                      href={`/?departmentId=${doctor.department.id}&doctorId=${doctor.id}#booking`}
                      className="rounded-md bg-[#0d4f8b] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#083d6d]"
                    >
                      Đặt lịch
                    </Link>
                  </div>
                </article>
              </ScrollReveal>
            ))
          ) : (
            <EmptyState
              label={
                loading ? "Đang tải bác sĩ..." : "Chưa có bác sĩ hiển thị."
              }
            />
          )}
        </div>
      </div>
    </section>
  );
}

function PackageSection({
  packages,
  loading,
}: {
  packages: PublicHomeData["packages"];
  loading: boolean;
}) {
  return (
    <section
      id="packages"
      className="ui-deferred-section mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8"
    >
      <SectionHeading
        eyebrow="Gói khám"
        title="Chi phí rõ ràng trước khi đặt lịch"
        action="Xem tất cả gói khám"
        actionHref="/packages"
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <ScrollReveal key={index} delay={index * 80}>
              <PackageSkeletonCard />
            </ScrollReveal>
          ))
        ) : packages.length ? (
          packages.map((item, index) => (
            <ScrollReveal key={item.id} delay={index * 80}>
              <article className="ui-lift-card rounded-md border border-[#dce3ee] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    <p className="mt-1 text-sm text-[#667892]">
                      {item.department?.name || "Đa chuyên khoa"}
                    </p>
                  </div>
                  {item.isPopular ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#fff4d6] px-2 py-1 text-xs font-semibold text-[#8a5a00]">
                      <Star className="h-3.5 w-3.5" />
                      Phổ biến
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#667892]">
                  {item.summary ||
                    item.description ||
                    "Gói khám được thiết kế để rút ngắn thời gian chuẩn bị và tối ưu chi phí."}
                </p>
                <p className="mt-5 text-2xl font-semibold text-[#0d4f8b]">
                  {formatCurrency(item.finalPrice)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.isBHYTSupport ? (
                    <span className="rounded-md bg-[#e7f6ed] px-2 py-1 text-xs font-semibold text-[#1f7a3a]">
                      Hỗ trợ BHYT
                    </span>
                  ) : null}
                  <span className="rounded-md bg-[#f1f5f9] px-2 py-1 text-xs font-semibold text-[#42526b]">
                    {item.items.length} hạng mục
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {item.slug ? (
                    <Link
                      href={`/packages/${item.slug}`}
                      className="rounded-md border border-[#cfd8e6] px-3 py-2 text-center text-xs font-semibold text-[#42526b] hover:bg-[#f8fafc]"
                    >
                      Chi tiết
                    </Link>
                  ) : (
                    <span className="rounded-md border border-[#e5ebf3] px-3 py-2 text-center text-xs font-semibold text-[#94a3b8]">
                      Chi tiết
                    </span>
                  )}
                  <Link
                    href={`/?${new URLSearchParams({ ...(item.department?.id ? { departmentId: item.department.id } : {}), packageId: item.id }).toString()}#booking`}
                    className="rounded-md bg-[#0d4f8b] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#083d6d]"
                  >
                    Chọn gói
                  </Link>
                </div>
              </article>
            </ScrollReveal>
          ))
        ) : (
          <EmptyState
            label={
              loading ? "Đang tải gói khám..." : "Chưa có gói khám hiển thị."
            }
          />
        )}
      </div>
    </section>
  );
}

function FaqTopicSection({
  faqs,
  loading,
}: {
  faqs: PublicHomeData["faqs"];
  loading: boolean;
}) {
  const groupedFaqs = faqCategoryOrder
    .map((category) => {
      const item = faqs.find((faq) => faq.category === category);
      return item ? { category, item, meta: faqCategoryMeta[category] } : null;
    })
    .filter(
      (
        item,
      ): item is {
        category: (typeof faqCategoryOrder)[number];
        item: PublicHomeData["faqs"][number];
        meta: (typeof faqCategoryMeta)[(typeof faqCategoryOrder)[number]];
      } => Boolean(item),
    );

  const otherFaqs = faqs
    .filter((faq) => !faq.category || !(faq.category in faqCategoryMeta))
    .slice(0, Math.max(0, 5 - groupedFaqs.length));

  return (
    <section id="faq" className="ui-deferred-section bg-white">
      <div className="mx-auto grid max-w-7xl scroll-mt-24 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <ScrollReveal>
          <div className="inline-flex items-center gap-2 rounded-md bg-[#e7f0fb] px-3 py-2 text-sm font-semibold text-[#0d4f8b]">
            <HelpCircle className="h-4 w-4" />
            Hỏi đáp
          </div>
          <h2 className="mt-4 text-3xl font-semibold">
            Câu hỏi theo từng chủ đề
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#667892]">
            Các câu hỏi nổi bật được nhóm theo 5 chủ đề để người bệnh tìm đúng
            thông tin nhanh hơn trước khi đặt lịch.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href="/faqs"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0d4f8b]"
            >
              Xem tất cả câu hỏi
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/guide/booking"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#42526b]"
            >
              Hướng dẫn đặt lịch
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </ScrollReveal>

        <div className="grid gap-3 sm:grid-cols-2">
          {loading ? (
            <FaqTopicSkeletonList />
          ) : groupedFaqs.length || otherFaqs.length ? (
            <>
              {groupedFaqs.map(({ category, item, meta }, index) => (
                <ScrollReveal key={item.id} delay={index * 60}>
                  <article className="ui-lift-card flex h-full flex-col rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4 hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#0d4f8b]">
                          {meta.label}
                        </p>
                        <h3 className="mt-2 line-clamp-2 font-semibold leading-6">
                          {item.question}
                        </h3>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-sm font-semibold text-[#0d4f8b]">
                        {index + 1}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#667892]">
                      {item.answer}
                    </p>
                    <p className="mt-4 text-xs leading-5 text-[#667892]">
                      {meta.description}
                    </p>
                    <Link
                      href={`/faqs?category=${category}`}
                      className="mt-auto inline-flex pt-4 text-sm font-semibold text-[#0d4f8b]"
                    >
                      Xem chủ đề <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </article>
                </ScrollReveal>
              ))}
              {otherFaqs.map((item, index) => (
                <ScrollReveal
                  key={item.id}
                  delay={(groupedFaqs.length + index) * 60}
                >
                  <article className="ui-lift-card flex h-full flex-col rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4 hover:bg-white">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#667892]">
                      Khác
                    </p>
                    <h3 className="mt-2 line-clamp-2 font-semibold leading-6">
                      {item.question}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#667892]">
                      {item.answer}
                    </p>
                    <Link
                      href="/faqs"
                      className="mt-auto inline-flex pt-4 text-sm font-semibold text-[#0d4f8b]"
                    >
                      Xem câu hỏi <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </article>
                </ScrollReveal>
              ))}
            </>
          ) : (
            <div className="sm:col-span-2">
              <EmptyState
                label={
                  loading
                    ? "Đang tải câu hỏi..."
                    : "Chưa có câu hỏi thường gặp."
                }
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FaqTopicSkeletonList() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <ScrollReveal key={index} delay={index * 50}>
          <div className="rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-3/4" />
              </div>
              <Skeleton className="h-8 w-8 shrink-0" />
            </div>
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
            <Skeleton className="mt-5 h-4 w-24" />
          </div>
        </ScrollReveal>
      ))}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FaqSection({
  faqs,
  loading,
}: {
  faqs: PublicHomeData["faqs"];
  loading: boolean;
}) {
  return (
    <section id="faq" className="bg-white">
      <div className="mx-auto grid max-w-7xl scroll-mt-24 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <ScrollReveal>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#667892]">
            Hỏi đáp
          </p>
          <h2 className="mt-2 text-3xl font-semibold">
            Câu hỏi thường gặp khi đặt lịch
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#667892]">
            Các thông tin này được lấy từ phần FAQ đã cấu hình trong dashboard.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href="/faqs"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0d4f8b]"
            >
              Xem tất cả câu hỏi
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/guide/booking"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#42526b]"
            >
              Hướng dẫn đặt lịch
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </ScrollReveal>
        <div className="space-y-3">
          {loading ? (
            <FaqSkeletonList />
          ) : faqs.length ? (
            faqs.map((item, index) => (
              <ScrollReveal key={item.id} delay={index * 60}>
                <details className="rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4 transition hover:border-[#0d4f8b]">
                  <summary className="cursor-pointer font-semibold">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-[#667892]">
                    {item.answer}
                  </p>
                </details>
              </ScrollReveal>
            ))
          ) : (
            <EmptyState
              label={loading ? "Đang tải câu hỏi..." : "Chưa có FAQ đặt lịch."}
            />
          )}
        </div>
      </div>
    </section>
  );
}

type SocialItem = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  className: string;
};

const socialLabels: Record<string, string> = {
  facebook: "Facebook",
  zalo: "Zalo",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const defaultSocialKeys = ["facebook", "zalo", "youtube", "tiktok"];

const normalizeExternalUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

function BrandSocialIcon({ name }: { name: string }) {
  const key = name.toLowerCase();

  if (key === "facebook") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M14.2 8.4V6.9c0-.7.5-.9 1-.9h1.8V3.3A24 24 0 0 0 14.4 3c-2.6 0-4.4 1.6-4.4 4.5v2H7.2v3.1H10V21h3.5v-8.4h2.8l.4-3.1h-3.2c-.3 0-.4-.1-.4-.4Z" />
      </svg>
    );
  }

  if (key === "youtube") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M21.6 7.1a3 3 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 8.9 2 12 2 12s0 3.1.4 4.9a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.4-1.8.4-4.9.4-4.9s0-3.1-.4-4.9ZM10 15.3V8.7l5.7 3.3-5.7 3.3Z" />
      </svg>
    );
  }

  if (key === "tiktok") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M15.4 3c.4 2.4 1.7 3.8 4.1 4v3.2a7 7 0 0 1-4-1.2v5.7c0 3.2-2.2 5.3-5.4 5.3A5.1 5.1 0 0 1 5 15c0-3 2.4-5.2 5.5-5.2.3 0 .6 0 .9.1v3.4a3 3 0 0 0-1-.2 1.9 1.9 0 1 0 1.9 1.9V3h3.1Z" />
      </svg>
    );
  }

  if (key === "zalo") {
    return (
      <Image
        src="/zalo.svg"
        alt=""
        width={24}
        height={24}
        aria-hidden="true"
        className="h-6 w-6"
      />
    );
  }

  return <ExternalLink className="h-4 w-4" aria-hidden="true" />;
}

const socialTone: Record<string, string> = {
  facebook: "text-[#1877f2] hover:bg-[#1877f2] hover:text-white",
  zalo: "text-[#0068ff] hover:bg-[#0068ff] hover:text-white",
  youtube: "text-[#ff0033] hover:bg-[#ff0033] hover:text-white",
  tiktok: "text-[#111827] hover:bg-[#111827] hover:text-white",
};

function createSocialItem(rawKey: string, value = ""): SocialItem {
  const key = rawKey.toLowerCase();

  return {
    key: rawKey,
    label: socialLabels[key] || rawKey,
    href: normalizeExternalUrl(value),
    icon: <BrandSocialIcon name={key} />,
    className:
      socialTone[key] || "text-[#42526b] hover:bg-[#42526b] hover:text-white",
  };
}

function getSocialItems(
  settings: PublicHomeData["settings"],
  showPlaceholders = false,
): SocialItem[] {
  if (!settings && showPlaceholders) {
    return defaultSocialKeys.map((key) => createSocialItem(key));
  }

  return Object.entries(settings?.socialLinks || {})
    .map<SocialItem>(([rawKey, value]) => createSocialItem(rawKey, value))
    .filter((item) => Boolean(item.href));
}

function PublicSocialDock({
  settings,
  hotline,
  loading,
}: {
  settings: PublicHomeData["settings"];
  hotline: string;
  loading: boolean;
}) {
  const socialItems = getSocialItems(settings, loading).slice(0, 4);

  if (!socialItems.length && !hotline) return null;

  return (
    <aside className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 xl:flex">
      <a
        href={`tel:${hotline}`}
        className="group inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#cfd8e6] bg-white text-[#0d4f8b] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#f3f8ff]"
        aria-label={`Gọi hotline ${hotline}`}
        title={`Gọi ${hotline}`}
      >
        <Phone
          className="h-5 w-5 transition group-hover:scale-110"
          aria-hidden="true"
        />
      </a>
      {socialItems.map((item) =>
        item.href ? (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className={`group inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#cfd8e6] bg-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 ${item.className}`}
            aria-label={`Mở ${item.label}`}
            title={item.label}
          >
            {item.icon}
          </a>
        ) : (
          <span
            key={item.key}
            className={`inline-flex h-11 w-11 animate-pulse items-center justify-center rounded-full border border-[#cfd8e6] bg-white shadow-lg shadow-black/10 ${item.className}`}
            aria-label={`Đang tải ${item.label}`}
            title={`Đang tải ${item.label}`}
          >
            {item.icon}
          </span>
        ),
      )}
    </aside>
  );
}

function PublicFooter({
  settings,
  hospitalName,
  logo,
  hotline,
  loading,
}: {
  settings: PublicHomeData["settings"];
  hospitalName: string;
  logo?: string;
  hotline: string;
  loading: boolean;
}) {
  const socialItems = getSocialItems(settings, loading);

  return (
    <footer className="border-t border-[#dce3ee] bg-[#172033] text-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-white/10">
              {logo ? (
                <Image
                  src={logo}
                  alt={hospitalName}
                  fill
                  sizes="40px"
                  unoptimized
                  className="object-contain p-1"
                />
              ) : (
                <Hospital className="h-5 w-5" />
              )}
            </span>
            <div>
              <p className="font-semibold">{hospitalName}</p>
              <p className="text-sm text-white/70">
                Nền tảng đặt lịch khám bệnh
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
            {settings?.workingHours ||
              "Làm việc theo khung giờ đã công bố. Vui lòng đặt lịch trước để được phục vụ tốt hơn."}
          </p>
        </div>
        <div className="space-y-3 text-sm text-white/80">
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {hotline}
          </p>
          {settings?.email ? <p>{settings.email}</p> : null}
          {settings?.address ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {settings.address}
            </p>
          ) : null}
          {settings?.mapUrl ? (
            <a
              href={normalizeExternalUrl(settings.mapUrl)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white hover:text-[#172033]"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Chỉ đường
            </a>
          ) : null}
          {socialItems.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {socialItems.map((item) =>
                item.href ? (
                  <a
                    key={item.key}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${item.className}`}
                  >
                    {item.icon}
                    {item.label}
                  </a>
                ) : (
                  <span
                    key={item.key}
                    className={`inline-flex animate-pulse items-center gap-2 rounded-full border border-white/15 bg-white px-3 py-2 text-xs font-semibold ${item.className}`}
                  >
                    {item.icon}
                    {item.label}
                  </span>
                ),
              )}
            </div>
          ) : null}
          {/* <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Thông tin cấu hình từ dashboard</p> */}
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs leading-5 text-white/60 sm:px-6">
        Xây dựng website quản lý đặt lịch khám bệnh có tích hợp chatbot hỗ trợ -
        Môn Tiểu Luận Chuyên Ngành - Ngô Quang Lợi - Trường Đại Học Công Nghệ Kỹ
        Thuật TP HCM - HCMUTE
      </div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
  actionHref = "#booking",
}: {
  eyebrow: string;
  title: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <ScrollReveal className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#667892]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
      </div>
      {action ? (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0d4f8b]"
        >
          {action} <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </ScrollReveal>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#dce3ee] bg-white p-6 text-center text-sm text-[#667892]">
      {label}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={`skeleton-shimmer block rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}

function DepartmentSkeletonCard() {
  return (
    <article className="min-h-[328px] overflow-hidden rounded-md border border-[#dce3ee] bg-white">
      <Skeleton className="h-36 rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <div className="grid grid-cols-2 gap-2 pt-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </div>
    </article>
  );
}

function DoctorSkeletonCard() {
  return (
    <article className="rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    </article>
  );
}

function PackageSkeletonCard() {
  return (
    <article className="rounded-md border border-[#dce3ee] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="mt-5 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="mt-6 h-8 w-32" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
    </article>
  );
}

function FaqSkeletonList() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <ScrollReveal key={index} delay={index * 50}>
          <div className="rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
          </div>
        </ScrollReveal>
      ))}
    </>
  );
}
