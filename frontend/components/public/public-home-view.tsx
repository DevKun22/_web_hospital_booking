"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  HeartPulse,
  PackageCheck,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { BackToTopButton } from "@/components/public/back-to-top-button";
import { PublicConsultationRequest } from "@/components/public/public-consultation-request";
import { PublicGlobalSearch } from "@/components/public/public-global-search";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { LazyMount } from "@/components/public/lazy-mount";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { usePublicSearchSuggestions } from "@/lib/public-search-query";
import { getPublicDoctorPath } from "@/lib/public-routes";
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
    <main id="main-content" tabIndex={-1} className="public-site min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <a className="ui-skip-link" href="#home-content">
        Bỏ qua điều hướng
      </a>
      <PublicSiteHeader settings={data.settings} />
      <div id="home-content" tabIndex={-1}>
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
      <PublicServiceHub />
      <DepartmentSection
        departments={data.departments.slice(0, 6)}
        loading={loading}
      />
      <DoctorSection doctors={data.doctors.slice(0, 4)} loading={loading} />
      <PackageSection packages={visiblePackages} loading={loading} />
      <LazyMount
        fallback={
          <section id="booking" className="ui-container scroll-mt-24 py-12 sm:py-16">
            <div className="skeleton-shimmer h-[420px] rounded-2xl border border-[var(--border)]" aria-label="Đang chuẩn bị form đặt lịch" />
          </section>
        }
      >
        <PublicBookingWidget data={data} loading={loading} />
      </LazyMount>
      <PublicConsultationRequest />
      <FaqTopicSection faqs={data.faqs.slice(0, 5)} loading={loading} />
      </div>
      <PublicSiteFooter settings={data.settings} />
      <BackToTopButton />
      <PublicChatbotWidget />
    </main>
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
    <section className="relative z-30 border-b border-[var(--public-border)] bg-[linear-gradient(180deg,#f4fbf9_0%,#eef7f4_100%)]">
      <div className="ui-container py-2.5 sm:py-3">
        <div className="grid gap-3 rounded-lg border border-white/90 bg-white/92 p-2.5 shadow-sm backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] md:items-center md:p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] sm:flex">
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#30c47c]" />
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold text-[var(--public-ink)]">Tìm nhanh</p>
                <span className="hidden text-xs text-[var(--public-muted)] sm:inline">
                  chuyên khoa, bác sĩ, gói khám và hướng dẫn tra cứu
                </span>
              </div>
              <div className="ui-hide-scrollbar mt-1.5 flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                {quickSearchKeywords.map((keyword) => (
                  <Link
                    key={keyword}
                    href={`/search?q=${encodeURIComponent(keyword)}`}
                    className="shrink-0 rounded-full border border-[var(--public-border)] bg-[var(--public-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--public-primary-dark)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
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

function PublicServiceHub() {
  const items = [
    {
      title: "Khám theo chuyên khoa",
      description: "Tìm đúng nơi tiếp nhận theo nhu cầu khám.",
      href: "/departments",
      icon: <HeartPulse className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "Chọn bác sĩ",
      description: "Xem chuyên môn, kinh nghiệm và phí khám.",
      href: "/bac-si",
      icon: <Stethoscope className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "Gói khám sức khỏe",
      description: "So sánh hạng mục, BHYT và tổng chi phí.",
      href: "/packages",
      icon: <PackageCheck className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "Đặt lịch trực tuyến",
      description: "Chọn ngày, giờ và xác thực OTP giữ lịch.",
      href: "/#booking",
      icon: <CalendarDays className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "Tra cứu lịch hẹn",
      description: "Theo dõi trạng thái và thông tin sau khám.",
      href: "/appointments/lookup",
      icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "Tìm kiếm dịch vụ",
      description: "Tìm bác sĩ, chuyên khoa, gói khám và hướng dẫn.",
      href: "/search",
      icon: <Search className="h-5 w-5" aria-hidden="true" />,
    },
  ];

  return (
    <section aria-labelledby="service-hub-title" className="border-y border-[var(--public-divider)] bg-white">
      <div className="ui-container py-8 sm:py-11">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--public-primary)]">Dịch vụ nổi bật</p>
            <h2 id="service-hub-title" className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[var(--public-ink)] sm:text-3xl">
              Bạn muốn bắt đầu từ đâu?
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[var(--public-muted)]">
            Mỗi lựa chọn dẫn tới một trang chuyên biệt để bạn xem đủ thông tin trước khi quyết định đặt lịch.
          </p>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-28 flex-col items-center gap-2 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-3 text-center shadow-sm transition hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--public-primary)_38%,var(--public-border))] hover:shadow-[var(--public-shadow-soft)] sm:flex-row sm:items-start sm:gap-4 sm:p-4 sm:text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)] transition group-hover:bg-[var(--public-primary)] group-hover:text-white">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="flex items-center justify-center gap-1 text-xs font-bold leading-4 text-[var(--public-ink)] sm:justify-start sm:gap-2 sm:text-base sm:leading-6">
                  {item.title}
                  <ChevronRight className="hidden h-4 w-4 text-[var(--public-primary)] transition group-hover:translate-x-1 sm:block" aria-hidden="true" />
                </span>
                <span className="mt-1.5 hidden text-sm leading-6 text-[var(--public-muted)] sm:block">{item.description}</span>
              </span>
            </Link>
          ))}
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
  const [carouselPaused, setCarouselPaused] = useState(false);
  const heroSlides = useMemo(
    () => (heroBanners.length ? heroBanners : promoBanner ? [promoBanner] : []),
    [heroBanners, promoBanner],
  );
  const activeBanner = heroSlides[selectedIndex] || heroSlides[0];
  const heroTitle = "Chăm sóc sức khỏe chủ động, đặt lịch thuận tiện";
  const heroSubtitle =
    "Tìm đúng chuyên khoa, chọn bác sĩ phù hợp và xem rõ chi phí trước khi xác nhận lịch khám.";
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
    if (!emblaApi || !hasMultipleSlides || carouselPaused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") emblaApi.scrollNext();
    }, 5200);

    return () => window.clearInterval(timer);
  }, [carouselPaused, emblaApi, hasMultipleSlides]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
    emblaApi.scrollTo(0);
  }, [emblaApi, heroSlides.length]);

  return (
    <section className="overflow-hidden bg-[radial-gradient(circle_at_12%_18%,rgba(46,159,130,0.14),transparent_28%),linear-gradient(180deg,#f4fbf9_0%,#ffffff_72%,#f7f9fc_100%)]">
      <div className="ui-container grid items-center gap-7 py-8 sm:gap-8 sm:py-12 lg:min-h-[610px] lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.96fr)] lg:gap-12 lg:py-14">
        <ScrollReveal className="max-w-2xl" initialVisible>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--public-primary-dark)] shadow-sm sm:text-sm">
            <Sparkles className="h-4 w-4" />
            Đồng hành trước, trong và sau buổi khám
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
            <h1 className="mt-5 text-[2rem] font-bold leading-[1.16] tracking-[-0.035em] text-[var(--public-ink)] sm:text-5xl lg:text-[3.45rem]">
              {heroTitle}
            </h1>
          )}
          <p
            className={`mt-5 max-w-xl text-base leading-7 text-[var(--public-text-soft)] sm:text-lg sm:leading-8 ${loading ? "hidden" : ""}`}
          >
            {heroSubtitle} Đặt lịch tại {hospitalName} bằng quy trình rõ ràng và dễ tra cứu.
          </p>
          <div
            className={`mt-5 hidden flex-wrap gap-2 text-xs font-semibold text-[var(--public-text-soft)] sm:flex ${loading ? "sm:hidden" : ""}`}
          >
            {[
              "Xác thực OTP",
              "Theo dõi trạng thái",
              "Tra cứu hóa đơn",
              "Hỗ trợ tư vấn",
            ].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--public-border)] bg-white px-3 py-1.5 shadow-sm"
              >
                <CheckCircle2
                  className="h-3.5 w-3.5 text-[var(--public-success)]"
                  aria-hidden="true"
                />
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="#booking"
              className="public-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
            >
              Đặt lịch ngay
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={`tel:${hotline}`}
              className="public-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
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
                className="rounded-xl border border-[var(--public-border)] bg-white p-3 shadow-sm sm:p-4"
              >
                {loading ? (
                  <Skeleton className="h-8 w-14" />
                ) : (
                  <p className="text-xl font-bold text-[var(--public-primary)] sm:text-2xl">
                    {value}
                  </p>
                )}
                <p className="mt-1 truncate text-xs text-[var(--public-muted)] sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal initialVisible>
          <div
            className="ui-soft-glow relative aspect-[4/3] min-h-0 overflow-hidden rounded-3xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] shadow-[var(--public-shadow-floating)] sm:aspect-[16/10] lg:min-h-[470px] lg:aspect-auto"
            onMouseEnter={() => setCarouselPaused(true)}
            onMouseLeave={() => setCarouselPaused(false)}
            onFocusCapture={() => setCarouselPaused(true)}
            onBlurCapture={() => setCarouselPaused(false)}
          >
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
                          <div className="h-full w-full bg-[linear-gradient(135deg,#ddf3ee_0%,#e9f3fa_55%,#fff3dd_100%)]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#ddf3ee_0%,#e9f3fa_55%,#fff3dd_100%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#052f2d]/88 via-[#075b58]/20 to-white/5" />
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
              {activeBanner?.title ? (
                <div className="mb-4 max-w-xl">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">Thông tin nổi bật</p>
                  <p className="mt-1 text-xl font-bold leading-tight">{activeBanner.title}</p>
                  {activeBanner.subtitle ? <p className="mt-1 line-clamp-2 text-sm text-white/76">{activeBanner.subtitle}</p> : null}
                </div>
              ) : null}
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
              <article className="ui-lift-card flex h-full min-h-[328px] flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-white shadow-sm">
                <div className="relative h-36 shrink-0 bg-[var(--public-primary-soft)]">
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
                    <div className="flex h-full items-center justify-center text-[var(--public-primary)]">
                      <HeartPulse className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 min-h-12 font-semibold leading-6">
                    {item.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 min-h-[72px] text-sm leading-6 text-[var(--public-muted)]">
                    {item.description ||
                      "Đội ngũ chuyên môn sẵn sàng tư vấn và tiếp nhận lịch khám."}
                  </p>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                    <Link
                      href={
                        item.slug
                          ? `/departments/${item.slug}`
                          : `/bac-si?departmentId=${item.id}`
                      }
                      className="public-button-secondary rounded-xl px-3 py-2 text-center text-xs font-bold"
                    >
                      Chi tiết
                    </Link>
                    <Link
                      href={`/?departmentId=${item.id}#booking`}
                      className="public-button-primary rounded-xl px-3 py-2 text-center text-xs font-bold"
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
    <section id="doctors" className="ui-deferred-section border-y border-[var(--public-divider)] bg-white">
      <div className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Bác sĩ"
          title="Đội ngũ đang sẵn sàng tiếp nhận"
          action="Xem tất cả bác sĩ"
          actionHref="/bac-si"
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <ScrollReveal key={index} delay={index * 70}>
                <DoctorSkeletonCard />
              </ScrollReveal>
            ))
          ) : doctors.length ? (
            doctors.map((doctor, index) => (
              <ScrollReveal key={doctor.id} delay={index * 70}>
                <article className="ui-lift-card flex h-full flex-col rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    {doctor.user.avatar ? (
                      <Image
                        src={doctor.user.avatar}
                        alt={doctor.user.fullName}
                        width={72}
                        height={72}
                        sizes="72px"
                        unoptimized
                        className="h-18 w-18 rounded-2xl object-cover ring-1 ring-[var(--public-border)]"
                      />
                    ) : (
                      <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-[var(--public-primary-soft)] text-xl font-bold text-[var(--public-primary)]">
                        {firstLetter(doctor.user.fullName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-lg font-bold leading-6 text-[var(--public-ink)]">
                        {doctorName(doctor)}
                      </h3>
                      <p className="mt-1 truncate text-sm font-medium text-[var(--public-primary)]">
                        {doctor.department.name}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2 rounded-xl bg-[var(--public-surface-muted)] p-3 text-sm text-[var(--public-muted)] sm:grid-cols-2">
                    <p className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-[var(--public-primary)]" />
                      {doctor.specialization || "Khám chuyên khoa"}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[var(--public-primary)]" />
                      {doctor.experience || 0} năm kinh nghiệm
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">Phí khám</span>
                    <p className="text-lg font-bold text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)}</p>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                    <Link
                      href={getPublicDoctorPath(doctor)}
                      className="public-button-secondary rounded-xl px-3 py-2.5 text-center text-xs font-bold"
                    >
                      Chi tiết
                    </Link>
                    <Link
                      href={`/?departmentId=${doctor.department.id}&doctorId=${doctor.id}#booking`}
                      className="public-button-primary rounded-xl px-3 py-2.5 text-center text-xs font-bold"
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
              <article className="ui-lift-card flex h-full flex-col rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    <p className="mt-1 text-sm text-[var(--public-muted)]">
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
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--public-muted)]">
                  {item.summary ||
                    item.description ||
                    "Gói khám được thiết kế để rút ngắn thời gian chuẩn bị và tối ưu chi phí."}
                </p>
                <p className="mt-5 text-2xl font-bold text-[var(--public-primary-dark)]">
                  {formatCurrency(item.finalPrice)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.isBHYTSupport ? (
                    <span className="rounded-full bg-[var(--public-success-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--public-success)]">
                      Hỗ trợ BHYT
                    </span>
                  ) : null}
                  <span className="rounded-full bg-[var(--public-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--public-text-soft)]">
                    {item.items.length} hạng mục
                  </span>
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                  {item.slug ? (
                    <Link
                      href={`/packages/${item.slug}`}
                      className="public-button-secondary rounded-xl px-3 py-2.5 text-center text-xs font-bold"
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
                    className="public-button-primary rounded-xl px-3 py-2.5 text-center text-xs font-bold"
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
          <div className="inline-flex items-center gap-2 rounded-xl bg-[var(--public-primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--public-primary-dark)]">
            <HelpCircle className="h-4 w-4" />
            Hỏi đáp
          </div>
          <h2 className="mt-4 text-3xl font-semibold">
            Câu hỏi theo từng chủ đề
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">
            Các câu hỏi nổi bật được nhóm theo 5 chủ đề để người bệnh tìm đúng
            thông tin nhanh hơn trước khi đặt lịch.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href="/faqs"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--public-primary)]"
            >
              Xem tất cả câu hỏi
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/guide/booking"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--public-text-soft)]"
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
                  <article className="ui-lift-card flex h-full flex-col rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-4 hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--public-primary)]">
                          {meta.label}
                        </p>
                        <h3 className="mt-2 line-clamp-2 font-semibold leading-6">
                          {item.question}
                        </h3>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-semibold text-[var(--public-primary)]">
                        {index + 1}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--public-muted)]">
                      {item.answer}
                    </p>
                    <p className="mt-4 text-xs leading-5 text-[var(--public-muted)]">
                      {meta.description}
                    </p>
                    <Link
                      href={`/faqs?category=${category}`}
                      className="mt-auto inline-flex pt-4 text-sm font-semibold text-[var(--public-primary)]"
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
                  <article className="ui-lift-card flex h-full flex-col rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-4 hover:bg-white">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">
                      Khác
                    </p>
                    <h3 className="mt-2 line-clamp-2 font-semibold leading-6">
                      {item.question}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--public-muted)]">
                      {item.answer}
                    </p>
                    <Link
                      href="/faqs"
                      className="mt-auto inline-flex pt-4 text-sm font-semibold text-[var(--public-primary)]"
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
          <div className="rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-4">
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
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--public-primary)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-[-0.025em] text-[var(--public-ink)]">{title}</h2>
      </div>
      {action ? (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--public-primary)]"
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
