import Image from "next/image";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoVariant = "horizontal" | "full" | "icon" | "light";
type BrandLogoSize = "sm" | "md" | "lg";

export type BrandLogoProps = {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  showTagline?: boolean;
  className?: string;
  // Biểu tượng chỉ để trang trí khi đã có chữ DevKunCare bên cạnh.
  decorative?: boolean;
};

// Kích thước gốc của từng tệp SVG, khai báo trước để không gây dịch bố cục (CLS).
const FILES = {
  horizontal: { src: "/branding/logo-horizontal.svg", width: 279, height: 64 },
  full: { src: "/branding/logo-full.svg", width: 422, height: 318 },
  icon: { src: "/branding/logo-icon.svg", width: 64, height: 64 },
  light: { src: "/branding/logo-light.svg", width: 279, height: 64 },
} as const;
const HORIZONTAL_DARK_SRC = "/branding/logo-light.svg";

// Chiều cao hiển thị (px); riêng logo đầy đủ tính theo chiều rộng.
const HEIGHT: Record<Exclude<BrandLogoVariant, "full">, Record<BrandLogoSize, number>> = {
  horizontal: { sm: 28, md: 36, lg: 48 },
  icon: { sm: 24, md: 32, lg: 48 },
  light: { sm: 28, md: 36, lg: 48 },
};
const FULL_WIDTH: Record<BrandLogoSize, number> = { sm: 160, md: 220, lg: 280 };

export function BrandLogo({
  variant = "horizontal",
  size = "md",
  showTagline = false,
  className,
  decorative = false,
}: BrandLogoProps) {
  const file = FILES[variant];
  const height = variant === "full" ? Math.round((FULL_WIDTH[size] * file.height) / file.width) : HEIGHT[variant][size];
  const width = Math.round((height * file.width) / file.height);
  const alt = decorative ? "" : variant === "full" ? `${BRAND_NAME} - ${BRAND_TAGLINE}` : BRAND_NAME;

  const image = (src: string, extra?: string) => (
    <Image
      src={src}
      alt={alt}
      aria-hidden={decorative || undefined}
      width={width}
      height={height}
      unoptimized
      priority={size !== "sm"}
      className={cn("brand-logo__img", extra)}
      style={{ width, height }}
    />
  );

  return (
    <span className={cn("brand-logo inline-flex flex-col items-start", className)}>
      {variant === "horizontal" ? (
        <>
          {image(file.src, "brand-logo__on-light")}
          {image(HORIZONTAL_DARK_SRC, "brand-logo__on-dark")}
        </>
      ) : (
        image(file.src)
      )}
      {showTagline && variant !== "full" ? (
        <span className="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--dk-teal-ink)]">
          {BRAND_TAGLINE}
        </span>
      ) : null}
    </span>
  );
}
