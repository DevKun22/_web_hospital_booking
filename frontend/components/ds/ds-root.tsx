"use client";

import { createContext, useContext, useState } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ds-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-ds-mono",
});

// Phần tử gốc của nền thiết kế: mang biến màu/chữ (`.ds`) và là nơi ngăn bên, hộp thoại gắn vào,
// để chúng cũng nhận đúng biến màu dù được render ra ngoài cây thường.
const DsRootContext = createContext<HTMLElement | null>(null);

export function useDsRoot() {
  return useContext(DsRootContext);
}

export function DsRoot({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null);

  return (
    <div ref={setElement} className={cn("ds", plexSans.variable, plexMono.variable, className)} {...rest}>
      <DsRootContext.Provider value={element}>{children}</DsRootContext.Provider>
    </div>
  );
}
