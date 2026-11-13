"use client";

import {
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  HeartPulse,
  Megaphone,
  PackageCheck,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicBottomNav } from "@/components/public/public-bottom-nav";
import { BackToTopButton } from "@/components/public/back-to-top-button";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { getPublicDoctorPath } from "@/lib/public-routes";
import { openPublicChatbot } from "@/lib/public-ui-events";
import type { Banner, DoctorProfile, HomePageConfigValue, HomePageSectionConfig } from "@/lib/types";
import type { PublicHomeData } from "./public-home-types";

import { formatCurrency } from "@/lib/format";
import { BRAND_NAME } from "@/lib/brand";
import { doctorDisplayName } from "@/lib/doctor";
type PublicHomeViewProps = {
  data: PublicHomeData;
  loading: boolean;
  error: string;
};

const PublicChatbotWidget = dynamic(
  () =>
    import("@/components/public/public-chatbot-widget").then(
      (module) => module.PublicChatbotWidget,
    ),
  { ssr: false },
);


const formatShortAppointmentDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));


const firstLetter = (value: string) =>
  value.trim().slice(0, 1).toUpperCase() || "H";

const safePublicHref = (value: string | null | undefined, fallback = "/") => {
  const href = value?.trim();
  if (!href) return fallback;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    return new URL(href).protocol === "https:" ? href : fallback;
  } catch {
    return fallback;
  }
};

export function PublicHomeView({ data, loading, error }: PublicHomeViewProps) {
  const hospitalName =
    data.settings?.hospitalName?.trim() || BRAND_NAME;
  const homeConfig = data.homeConfig;

  return (
    <main id="main-content" tabIndex={-1} className="public-site public-has-bottom-nav min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <a className="ui-skip-link" href="#home-content">
        Bỏ qua điều hướng
      </a>
      <PublicSiteHeader settings={data.settings} />
      <div id="home-content" tabIndex={-1}>
      {error ? (
        <section className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-4 py-3 text-sm text-[#b3261e]">
            {error}
          </div>
        </section>
      ) : null}

      <HeroSection
        hospitalName={hospitalName}
        heroBanners={data.heroBanners}
        announcement={homeConfig?.announcement}
        loading={loading}
      />
      {homeConfig?.sections.serviceHub.enabled !== false ? <PublicServiceHub /> : null}
      {homeConfig?.sections.departments.enabled !== false ? (
        <DepartmentSection departments={data.departments} config={homeConfig?.sections.departments} loading={loading} />
      ) : null}
      {homeConfig?.sections.doctors.enabled !== false ? (
        <DoctorSection doctors={data.doctors} config={homeConfig?.sections.doctors} loading={loading} />
      ) : null}
      {homeConfig?.sections.packages.enabled !== false ? (
        <PackageSection packages={data.packages} config={homeConfig?.sections.packages} loading={loading} />
      ) : null}
      {homeConfig?.sections.partners.enabled !== false && data.partnerBanners.length ? (
        <PartnerLogoSection banners={data.partnerBanners} config={homeConfig?.sections.partners} />
      ) : null}
      </div>
      <PublicSiteFooter settings={data.settings} />
      <BackToTopButton />
      <PublicChatbotWidget />
      <PublicBottomNav />
    </main>
  );
}

function PublicServiceHub() {
  const primaryItems = [
    {
      title: "Đặt lịch khám",
      description: "Chọn chuyên khoa, bác sĩ và thời gian phù hợp.",
      href: "/dat-lich",
      icon: <CalendarDays className="h-6 w-6" aria-hidden="true" />,
    },
    {
      title: "Khám chuyên khoa",
      description: "Tìm đúng nơi tiếp nhận theo nhu cầu khám.",
      href: "/chuyen-khoa",
      icon: <HeartPulse className="h-6 w-6" aria-hidden="true" />,
    },
    {
      title: "Đội ngũ bác sĩ",
      description: "Xem chuyên môn, kinh nghiệm và phí khám.",
      href: "/bac-si",
      icon: <Stethoscope className="h-6 w-6" aria-hidden="true" />,
    },
    {
      title: "Gói khám & tầm soát",
      description: "So sánh hạng mục, BHYT và tổng chi phí.",
      href: "/goi-kham",
      icon: <PackageCheck className="h-6 w-6" aria-hidden="true" />,
    },
  ];

  const utilityItems = [
    { title: "Tra cứu lịch hẹn", href: "/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen", icon: ShieldCheck },
    { title: "Tìm kiếm dịch vụ", href: "/tim-kiem", icon: Search },
    { title: "Hỏi đáp & hướng dẫn", href: "/ho-tro", icon: HelpCircle },
  ];

  return (
    <section aria-labelledby="service-hub-title" className="border-y border-[var(--public-divider)] bg-white">
      <div className="ui-container py-8 sm:py-12">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {primaryItems.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex min-h-40 flex-col gap-3 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-[var(--public-shadow-soft)] sm:min-h-48 sm:gap-4 sm:p-5 ${
                index === 0
                  ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white"
                  : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-ink)] hover:border-[var(--public-primary)]"
              }`}
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${
                index === 0
                  ? "bg-white/18 text-white ring-1 ring-white/25"
                  : "bg-[var(--public-primary-soft)] text-[var(--public-primary)] group-hover:bg-[var(--public-primary)] group-hover:text-white"
              }`}>
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="flex items-center justify-between gap-2 text-base font-bold leading-6">
                  {item.title}
                  <ChevronRight className={`hidden h-4 w-4 transition group-hover:translate-x-1 sm:block ${index === 0 ? "text-white" : "text-[var(--public-primary)]"}`} aria-hidden="true" />
                </span>
                <span className={`mt-2 block text-sm leading-6 ${index === 0 ? "text-white/82" : "text-[var(--public-muted)]"}`}>{item.description}</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {utilityItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group flex min-h-14 items-center gap-3 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] px-4 py-3 text-sm font-bold text-[var(--public-ink)] transition hover:border-[var(--public-primary)] hover:bg-white">
                <Icon className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                <span className="min-w-0 flex-1">{item.title}</span>
                <ChevronRight className="h-4 w-4 text-[var(--public-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--public-primary)]" aria-hidden="true" />
              </Link>
            );
          })}
          <div aria-disabled="true" data-future-feature="patient-account" className="flex min-h-14 cursor-not-allowed items-center gap-3 rounded-xl border border-dashed border-[var(--public-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--public-muted)]">
            <UserRound className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">Hồ sơ người khám</span>
            <span className="rounded-full bg-[var(--public-primary-soft)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--public-primary-dark)]">Sắp có</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroSection({
  hospitalName,
  heroBanners,
  announcement,
  loading,
}: {
  hospitalName: string;
  heroBanners: Banner[];
  announcement?: HomePageConfigValue["announcement"];
  loading: boolean;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    duration: 32,
    dragFree: false,
    skipSnaps: false,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const heroSlides = useMemo(() => heroBanners.slice(0, 5), [heroBanners]);
  const activeBanner = heroSlides[selectedIndex] || heroSlides[0];
  const heroTitle =
    activeBanner?.title?.trim() ||
    "Chăm sóc sức khỏe chủ động, đặt lịch thuận tiện";
  const heroSubtitle =
    activeBanner?.subtitle?.trim() ||
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

    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") emblaApi.scrollNext();
    }, 6200);

    return () => window.clearTimeout(timer);
  }, [carouselPaused, emblaApi, hasMultipleSlides, selectedIndex]);

  return (
    <section className="overflow-hidden bg-[var(--public-canvas)] pb-6 sm:pb-8">
      <div className="w-full">
        <ScrollReveal initialVisible>
          <div
            className="relative min-h-[500px] cursor-grab touch-pan-y select-none overflow-hidden border-b border-[var(--public-border)] bg-[var(--public-primary-soft)] shadow-[var(--public-shadow-floating)] active:cursor-grabbing sm:min-h-[520px] xl:min-h-[540px]"
            onFocusCapture={() => setCarouselPaused(true)}
            onBlurCapture={() => setCarouselPaused(false)}
          >
            {loading ? (
              <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            ) : heroSlides.length ? (
              <div
                ref={emblaRef}
                className="public-hero-viewport absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
                role="region"
                aria-roledescription="carousel"
                aria-label="Banner dịch vụ nổi bật - giữ chuột và kéo để chuyển banner"
              >
                <div className="flex h-full touch-pan-y will-change-transform">
                  {heroSlides.map((slide, index) => {
                    return (
                      <div key={slide.id} className="public-hero-slide relative min-w-0 flex-[0_0_100%]">
                        {slide.image ? (
                          <>
                            {slide.mobileImage ? (
                              <Image
                                src={slide.mobileImage}
                                alt={slide.title || hospitalName}
                                fill
                                sizes="100vw"
                                priority={index === 0}
                                loading={index === 1 ? "eager" : undefined}
                                quality={75}
                                draggable={false}
                                className="object-cover sm:hidden"
                              />
                            ) : null}
                            <Image
                            src={slide.image}
                            alt={slide.title || hospitalName}
                            fill
                            sizes="(min-width: 1280px) 1280px, 100vw"
                            priority={index === 0}
                            loading={index === 1 ? "eager" : undefined}
                            quality={75}
                            draggable={false}
                            className={`object-cover ${slide.mobileImage ? "hidden sm:block" : ""}`}
                          />
                          </>
                        ) : (
                          <div className="h-full w-full bg-[linear-gradient(135deg,#dbeafe_0%,#e7f0ff_50%,#ffffff_100%)]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#dbeafe_0%,#e7f0ff_50%,#ffffff_100%)]" />
            )}

            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.2)_35%,rgba(15,23,42,0.78)_100%)]" />
            <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex max-w-[72%] items-center gap-2 rounded-full border border-white/40 bg-white/88 px-3 py-1.5 text-xs font-bold text-[var(--public-primary-dark)] shadow-lg backdrop-blur sm:left-6 sm:top-6">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Thông tin chăm sóc sức khỏe nổi bật
            </div>

            {!loading && hasMultipleSlides ? (
              <div className="pointer-events-none absolute inset-y-0 left-3 right-3 z-10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => emblaApi?.scrollPrev()}
                  className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[var(--public-ink)] shadow-lg transition hover:bg-white"
                  aria-label="Banner trước"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => emblaApi?.scrollNext()}
                  className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[var(--public-ink)] shadow-lg transition hover:bg-white"
                  aria-label="Banner tiếp theo"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <div className="absolute inset-x-4 bottom-5 z-20 mx-auto max-w-2xl rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 text-center shadow-[var(--public-shadow-floating)] sm:inset-x-8 sm:bottom-8 sm:p-6 lg:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-primary)]">
                Đồng hành trước, trong và sau buổi khám
              </p>
              {loading ? (
                <div className="mx-auto mt-3 max-w-lg space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="mx-auto h-4 w-4/5" />
                </div>
              ) : (
                <h1 className="mt-2 text-2xl font-bold leading-tight tracking-[-0.025em] text-[var(--public-ink)] sm:text-3xl lg:text-4xl">
                  {heroTitle}
                </h1>
              )}
              <p className={`mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--public-text-soft)] sm:text-base ${loading ? "hidden" : ""}`}>
                {heroSubtitle}
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2.5 sm:flex-row">
                <Link
                  href={safePublicHref(activeBanner?.linkUrl, "/dat-lich")}
                  target={activeBanner?.target === "_blank" ? "_blank" : undefined}
                  rel={activeBanner?.target === "_blank" ? "noreferrer" : undefined}
                  className="public-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Đặt lịch khám ngay
                </Link>
                <button type="button" onClick={openPublicChatbot} className="public-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold">
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--public-success)] opacity-70 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--public-success)]" />
                  </span>
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Trợ lý AI
                </button>
              </div>
            </div>

            {hasMultipleSlides ? (
              <div className="absolute bottom-4 right-4 z-30 hidden items-center gap-2 lg:flex">
                <span className="rounded-full bg-slate-950/65 px-3 py-2 text-xs font-bold text-white backdrop-blur">
                  {selectedIndex + 1}/{heroSlides.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCarouselPaused((current) => !current)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/65 text-white backdrop-blur transition hover:bg-slate-950/80"
                  aria-label={carouselPaused ? "Tiếp tục trình chiếu" : "Tạm dừng trình chiếu"}
                  aria-pressed={carouselPaused}
                >
                  {carouselPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            ) : null}
          </div>
        </ScrollReveal>

        <ProgramAnnouncementBar announcement={announcement} />
      </div>
    </section>
  );
}

function ProgramAnnouncementBar({
  announcement,
}: {
  announcement?: HomePageConfigValue["announcement"];
}) {
  const [paused, setPaused] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const content = announcement || {
    enabled: true,
    label: "Chương trình sức khỏe",
    message: "Chủ động chọn bác sĩ, ngày khám và gói chăm sóc phù hợp cho bạn và gia đình.",
    ctaLabel: "Khám phá",
    ctaHref: "/goi-kham",
    startAt: null,
    endAt: null,
  };
  const isInDisplayWindow =
    (!content.startAt || new Date(content.startAt).getTime() <= renderedAt) &&
    (!content.endAt || new Date(content.endAt).getTime() >= renderedAt);

  if (!content.enabled || !isInDisplayWindow) return null;

  const tickerCopy = (duplicate = false) => (
    <span className="public-program-ticker-copy" aria-hidden={duplicate || undefined}>
      <strong>{content.label}</strong>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" aria-hidden="true" />
      <span>{content.message}</span>
    </span>
  );

  return (
    <aside
      aria-label={`${content.label}: ${content.message}`}
      data-dashboard-slot="home-program-notice"
      className="ui-container mt-4"
    >
      <div className="relative isolate grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border border-white/20 bg-[linear-gradient(105deg,var(--public-primary-dark)_0%,var(--public-primary)_52%,#0f766e_100%)] px-3 py-3 text-white shadow-[0_16px_36px_rgba(15,76,92,0.18)] sm:gap-4 sm:px-5">
        <span className="pointer-events-none absolute -right-10 -top-16 -z-10 h-44 w-44 rounded-full border-[28px] border-white/8" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-20 left-1/3 -z-10 h-36 w-36 rounded-full bg-white/6 blur-2xl" aria-hidden="true" />

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/14 text-white ring-1 ring-white/25">
          <Megaphone className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
          <p className="sr-only">{content.label}: {content.message}</p>
          <div className="public-program-ticker-track" data-paused={paused} aria-hidden="true">
            {tickerCopy()}
            {tickerCopy(true)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setPaused((current) => !current)}
            aria-label={paused ? "Tiếp tục chạy thông báo" : "Tạm dừng thông báo"}
            aria-pressed={paused}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/35 motion-reduce:hidden"
          >
            {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          </button>
          <Link
            href={safePublicHref(content.ctaHref, "/goi-kham")}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--public-primary-dark)] shadow-sm transition hover:bg-[var(--public-primary-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/35 sm:px-4 sm:text-sm"
          >
            <span className="hidden sm:inline">{content.ctaLabel}</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

function DepartmentSection({
  departments,
  config,
  loading,
}: {
  departments: PublicHomeData["departments"];
  config?: HomePageSectionConfig;
  loading: boolean;
}) {
  return (
    <section
      id="departments"
      className="ui-deferred-section mx-auto max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
    >
      <SectionHeading
        eyebrow={config?.eyebrow || "Chuyên khoa"}
        title={config?.title || "Chọn đúng nơi bắt đầu"}
        description={config?.description}
        action="Xem tất cả chuyên khoa"
        actionHref="/chuyen-khoa"
      />
      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <ScrollReveal key={index} delay={index * 70}>
              <DepartmentSkeletonCard />
            </ScrollReveal>
          ))
        ) : departments.length ? (
          departments.map((item, index) => (
            <ScrollReveal key={item.id} delay={index * 70}>
              <Link
                href={item.slug ? `/chuyen-khoa/${item.slug}` : `/bac-si?departmentId=${item.id}`}
                className="ui-lift-card group flex h-full min-h-[232px] flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-white shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--public-primary-soft)] sm:min-h-[292px]"
              >
                <span className="relative h-28 shrink-0 overflow-hidden bg-[var(--public-primary-soft)] sm:h-36">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      quality={75}
                      className="object-cover transition duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--public-primary)]">
                      <HeartPulse className="h-10 w-10" aria-hidden="true" />
                    </div>
                  )}
                </span>
                <span className="flex flex-1 flex-col p-3 sm:p-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--public-primary)] sm:text-xs">
                    Khám chuyên khoa
                  </span>
                  <h3 className="mt-1.5 line-clamp-2 min-h-11 text-sm font-bold leading-[1.35rem] text-[var(--public-ink)] sm:min-h-12 sm:text-base sm:leading-6">
                    {item.name}
                  </h3>
                  <span className="mt-2 hidden line-clamp-2 min-h-11 text-sm leading-[1.375rem] text-[var(--public-muted)] sm:block">
                    {item.description ||
                      "Đội ngũ chuyên môn sẵn sàng tư vấn và tiếp nhận lịch khám."}
                  </span>
                  <span className="mt-auto inline-flex min-h-11 items-center justify-between gap-2 pt-3 text-xs font-bold text-[var(--public-primary)] sm:text-sm">
                    Xem chuyên khoa
                    <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                </span>
              </Link>
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
  config,
  loading,
}: {
  doctors: DoctorProfile[];
  config?: HomePageSectionConfig;
  loading: boolean;
}) {
  const getBookingPath = (doctor: DoctorProfile) =>
    `/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}`;

  return (
    <section id="doctors" className="ui-deferred-section border-y border-[var(--public-divider)] bg-white">
      <div className="mx-auto max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <ScrollReveal className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--public-primary)]">{config?.eyebrow || "Chuyên gia đầu ngành"}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[var(--public-ink)] sm:text-3xl">
              {config?.title || "Bác sĩ tiêu biểu đang tiếp nhận lịch khám"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)]">
              {config?.description || "Thông tin chuyên môn, đánh giá, chi phí và giờ khám được hiển thị trực tiếp từ dữ liệu hệ thống."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--public-success-soft)] px-3 py-2 text-xs font-bold text-[var(--public-success)]">
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              Có thể chọn ngày khám phù hợp
            </span>
            <Link href="/bac-si" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[var(--public-primary)]">
              Xem tất cả <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <ScrollReveal key={index} delay={index * 70}>
                <DoctorSkeletonCard />
              </ScrollReveal>
            ))
          ) : doctors.length ? (
            doctors.map((doctor, index) => (
              <ScrollReveal key={doctor.id} delay={index * 70}>
                <article className="ui-lift-card flex h-full flex-col rounded-2xl border border-[var(--public-border)] bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <Link href={getPublicDoctorPath(doctor)} className="relative shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--public-primary-soft)]" aria-label={`Xem hồ sơ ${doctorDisplayName(doctor)}`}>
                      {doctor.user.avatar ? (
                        <Image
                          src={doctor.user.avatar}
                          alt={doctor.user.fullName}
                          width={64}
                          height={64}
                          sizes="64px"
                          quality={75}
                          className="h-16 w-16 rounded-xl object-cover ring-1 ring-[var(--public-border)]"
                        />
                      ) : (
                        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-xl font-bold text-[var(--public-primary)] ring-1 ring-[var(--public-border)]">
                          {firstLetter(doctor.user.fullName)}
                        </span>
                      )}
                      <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${doctor.isAvailable === false ? "bg-[var(--public-muted)]" : "bg-[var(--public-success)]"}`} aria-hidden="true" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      {doctor.reviewSummary?.count ? (
                        <p className="flex items-center gap-1 text-xs font-bold text-[#d97706]">
                          <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                          {doctor.reviewSummary.averageRating.toFixed(1)}
                          <span className="font-medium text-[var(--public-muted)]">({doctor.reviewSummary.count} đánh giá)</span>
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-[var(--public-muted)]">Chưa có đánh giá công khai</p>
                      )}
                      <h3 className="mt-1 line-clamp-1 text-base font-bold leading-6 text-[var(--public-ink)] sm:text-lg">
                        <Link href={getPublicDoctorPath(doctor)} className="transition hover:text-[var(--public-primary)]">{doctorDisplayName(doctor)}</Link>
                      </h3>
                      <p className="truncate text-xs font-semibold text-[var(--public-primary)] sm:text-sm">{doctor.department.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--public-muted)]">
                        {doctor.experience ? `${doctor.experience} năm kinh nghiệm` : doctor.specialization || "Khám chuyên khoa"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#bfdbfe] bg-[var(--public-primary-soft)] px-3 py-3 text-xs text-[var(--public-primary-dark)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
                        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {doctor.todayAvailableSlots?.length ? "Giờ trống hôm nay" : "Lịch khám gần nhất"}
                      </span>
                      <Link href={getBookingPath(doctor)} className="shrink-0 font-bold underline-offset-4 hover:underline">
                        {doctor.todayAvailableSlots?.length ? "Xem thêm lịch" : "Xem ngày tiếp theo"}
                      </Link>
                    </div>
                    {doctor.todayAvailableSlots?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2" aria-label="Các giờ khám còn trống hôm nay">
                        {doctor.todayAvailableSlots.slice(0, 3).map((slot) => (
                          <Link
                            key={slot.id}
                            href={getBookingPath(doctor)}
                            className="inline-flex min-h-8 items-center rounded-lg border border-white/80 bg-white px-2.5 py-1 font-bold tabular-nums shadow-sm transition hover:border-[var(--public-primary)]"
                          >
                            {slot.startTime.slice(0, 5)}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 leading-5 text-[var(--public-muted)]">
                        {doctor.nextAvailableSlot
                          ? `${formatShortAppointmentDate(doctor.nextAvailableSlot.date)}, ${doctor.nextAvailableSlot.startTime.slice(0, 5)}–${doctor.nextAvailableSlot.endTime.slice(0, 5)}`
                          : "Chọn ngày phù hợp để xem toàn bộ giờ còn nhận lịch."}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--public-divider)] pt-3">
                    <span className="text-xs font-medium text-[var(--public-muted)]">Phí khám chuyên khoa</span>
                    <p className="text-base font-bold tabular-nums text-[var(--public-ink)]">{formatCurrency(doctor.consultationFee)}</p>
                  </div>

                  <Link
                    href={getBookingPath(doctor)}
                    className="public-button-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-center text-sm font-bold"
                  >
                    {doctor.todayAvailableSlots?.length ? "Đặt lịch với bác sĩ" : "Chọn ngày khám phù hợp"}
                  </Link>
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
  config,
  loading,
}: {
  packages: PublicHomeData["packages"];
  config?: HomePageSectionConfig;
  loading: boolean;
}) {
  return (
    <section
      id="packages"
      className="ui-deferred-section scroll-mt-24 bg-[var(--public-canvas)] py-10 sm:py-14"
    >
      <div className="ui-container">
        <ScrollReveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold text-[var(--public-primary)]">{config?.eyebrow || "Chủ động phòng ngừa bệnh"}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[var(--public-ink)] sm:text-3xl">
            {config?.title || "Gói khám sức khỏe và tầm soát toàn diện"}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)] sm:text-base">
            {config?.description || "So sánh minh bạch chi phí, hạng mục thực hiện và chính sách hỗ trợ BHYT trước khi đăng ký."}
          </p>
        </ScrollReveal>
        <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <ScrollReveal key={index} delay={index * 80}>
              <PackageSkeletonCard />
            </ScrollReveal>
          ))
        ) : packages.length ? (
          packages.map((item, index) => {
            const includedItems = item.items.filter((packageItem) => packageItem.included);
            const visibleItems = includedItems.slice(0, 4);

            return (
              <ScrollReveal key={item.id} delay={index * 80} className={item.isPopular ? "lg:-translate-y-3" : ""}>
                <article className={`ui-lift-card relative flex h-full min-h-[420px] flex-col rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${
                  item.isPopular
                    ? "border-[var(--public-primary)] ring-2 ring-[var(--public-primary-soft)]"
                    : "border-[var(--public-border)]"
                }`}>
                  {item.isPopular ? (
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[var(--public-primary)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-md">
                      Gói được đăng ký nhiều nhất
                    </span>
                  ) : null}

                  <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
                    {item.department?.name ? (
                      <span className="rounded-full bg-[var(--public-primary-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--public-primary-dark)]">
                        {item.department.name}
                      </span>
                    ) : <span />}
                    {item.isBHYTSupport ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--public-success)]">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Hỗ trợ BHYT
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-4 text-xl font-bold leading-7 text-[var(--public-ink)]">
                    {item.slug ? <Link href={`/goi-kham/${item.slug}`} className="transition hover:text-[var(--public-primary)]">{item.name}</Link> : item.name}
                  </h3>
                  {item.summary || item.description ? (
                    <p className="mt-2 line-clamp-3 min-h-[72px] text-sm leading-6 text-[var(--public-muted)]">
                      {item.summary || item.description}
                    </p>
                  ) : <div className="min-h-[72px]" aria-hidden="true" />}

                  <div className="mt-5 flex min-h-10 flex-wrap items-end gap-x-3 gap-y-1">
                    <p className={`text-3xl font-bold tabular-nums ${item.isPopular ? "text-[var(--public-primary)]" : "text-[var(--public-ink)]"}`}>
                      {formatCurrency(item.finalPrice)}
                    </p>
                  </div>

                  {visibleItems.length ? (
                    <div className="mt-5 border-t border-[var(--public-divider)] pt-4">
                      <ul className="space-y-3">
                        {visibleItems.map((packageItem) => (
                          <li key={packageItem.id} className="flex items-start gap-2 text-sm leading-5 text-[var(--public-text-soft)]">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                            <span>{packageItem.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-auto border-t border-[var(--public-divider)] pt-4">
                    <Link
                      href={`/dat-lich?${new URLSearchParams({ ...(item.department?.id ? { departmentId: item.department.id } : {}), packageId: item.id }).toString()}`}
                      className={`${item.isPopular ? "public-button-primary" : "public-button-secondary"} inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-center text-sm font-bold`}
                    >
                      Đăng ký {item.name.toLocaleLowerCase("vi-VN")}
                    </Link>
                  </div>
                </article>
              </ScrollReveal>
            );
          })
        ) : (
          <EmptyState
            label={
              loading ? "Đang tải gói khám..." : "Chưa có gói khám hiển thị."
            }
          />
        )}
        </div>
      </div>
    </section>
  );
}

function PartnerLogoSection({ banners, config }: { banners: Banner[]; config?: HomePageSectionConfig }) {
  const [paused, setPaused] = useState(false);
  const verifiedPartners = banners;

  return (
    <section
      aria-labelledby="partner-heading"
      className="ui-deferred-section overflow-hidden border-y border-[var(--public-divider)] bg-white py-10 sm:py-12"
      data-dashboard-slot="home-partner-logos"
    >
      <div className="ui-container">
        <ScrollReveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--public-primary)]">{config?.eyebrow || "Mạng lưới đồng hành"}</p>
            <h2 id="partner-heading" className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[var(--public-ink)] sm:text-3xl">
              {config?.title || "Kết nối hệ sinh thái chăm sóc sức khỏe"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)]">
              {config?.description || "Các đơn vị hợp tác đã được bệnh viện xác thực và công bố."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPaused((current) => !current)}
            aria-label={paused ? "Tiếp tục chạy danh sách đối tác" : "Tạm dừng danh sách đối tác"}
            aria-pressed={paused}
            className="hidden min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--public-border)] bg-white px-4 text-sm font-bold text-[var(--public-primary)] transition hover:bg-[var(--public-primary-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--public-primary-soft)] sm:inline-flex motion-reduce:hidden"
          >
            {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            {paused ? "Tiếp tục" : "Tạm dừng"}
          </button>
        </ScrollReveal>
      </div>

      <div className="public-partner-logo-viewport mt-7" aria-label="Nhóm đối tác dự kiến hiển thị">
        <div className="public-partner-logo-track" data-paused={paused}>
          {[0, 1].map((copyIndex) => (
            <div
              key={copyIndex}
              className="public-partner-logo-group"
              aria-hidden={copyIndex === 1}
            >
              {verifiedPartners.map((partner) => {
                    const content = (
                      <>
                        <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-[var(--public-border)]">
                          <Image
                            src={partner.image}
                            alt=""
                            fill
                            sizes="80px"
                            quality={75}
                            className="object-contain p-2"
                          />
                        </span>
                        <span className="line-clamp-2 text-sm font-bold leading-5 text-[var(--public-ink)]">{partner.title}</span>
                      </>
                    );

                    const partnerHref = safePublicHref(partner.linkUrl, "");
                    return partnerHref ? (
                      <a
                        key={`${copyIndex}-${partner.id}`}
                        href={partnerHref}
                        target={partner.target === "_blank" ? "_blank" : undefined}
                        rel={partner.target === "_blank" ? "noreferrer" : undefined}
                        className="flex h-24 w-64 shrink-0 items-center gap-4 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] px-5 shadow-sm transition hover:border-[var(--public-primary)] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--public-primary-soft)]"
                      >
                        {content}
                      </a>
                    ) : (
                      <div
                        key={`${copyIndex}-${partner.id}`}
                        className="flex h-24 w-64 shrink-0 items-center gap-4 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] px-5 shadow-sm"
                      >
                        {content}
                      </div>
                    );
                  })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  actionHref = "/dat-lich",
}: {
  eyebrow: string;
  title: string;
  description?: string;
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
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)]">{description}</p> : null}
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
