import { cn } from "@/lib/utils";

// Kun: linh vật của trợ lý ảo, một bong bóng chat màu thương hiệu có khuôn mặt. Vẽ bằng SVG để sắc nét ở mọi cỡ và nhẹ;
// chuyển động (nháy mắt, nhún nhẹ, nghĩ) nằm trong globals.css (.kun-*) và tắt khi người dùng chọn giảm chuyển động.

export type KunMood = "idle" | "thinking" | "happy" | "alert";

export function KunAvatar({ mood = "idle", size = 40, className }: { mood?: KunMood; size?: number; className?: string }) {
  const body = mood === "alert" ? "var(--public-danger)" : "var(--dk-teal)";
  return (
    <svg
      className={cn("kun", `kun--${mood}`, className)}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Kun, trợ lý ảo"
    >
      <path
        className="kun__body"
        d="M24 5C13.5 5 6 12 6 21.5c0 5.2 2.3 9.6 6 12.6-.2 3.2-1.4 5.7-3.4 7.7 4.2-.2 7.6-1.6 10.2-3.9 3.2 1.2 5.8 1.6 11.2 1.6C34.5 39.5 42 32.5 42 23S34.5 5 24 5Z"
        fill={body}
      />
      {mood === "happy" ? (
        <>
          <path d="M16 21c1-2.6 4-2.6 5 0" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M27 21c1-2.6 4-2.6 5 0" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <g className="kun__eyes">
          <ellipse cx="18.5" cy="21" rx="2.4" ry="3" fill="#fff" />
          <ellipse cx="29.5" cy="21" rx="2.4" ry="3" fill="#fff" />
        </g>
      )}
      {mood === "alert" ? (
        <ellipse cx="24" cy="29" rx="2.6" ry="3" fill="#fff" />
      ) : mood === "thinking" ? (
        <circle cx="24" cy="29" r="1.8" fill="#fff" />
      ) : (
        <path d="M18.5 28c1.6 2.6 9.4 2.6 11 0" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      )}
      <circle cx="13.5" cy="27" r="2.2" fill="#fff" opacity="0.22" />
      <circle cx="34.5" cy="27" r="2.2" fill="#fff" opacity="0.22" />
    </svg>
  );
}
