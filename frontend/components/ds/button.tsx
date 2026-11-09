import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost" | "danger";

export type DsButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "md" | "lg";
  icon?: boolean;
  loading?: boolean;
};

export const DsButton = React.forwardRef<HTMLButtonElement, DsButtonProps>(function DsButton(
  { variant = "default", size = "md", icon = false, loading = false, className, disabled, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "ds-btn",
        variant !== "default" && `ds-btn--${variant}`,
        size === "lg" && "ds-btn--lg",
        icon && "ds-btn--icon",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
