"use client";

import { createContext, useContext, useState } from "react";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { cn } from "@/lib/utils";

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
    <div ref={setElement} className={cn("ds", className)} {...rest}>
      <DsRootContext.Provider value={element}>{children}</DsRootContext.Provider>
    </div>
  );
}
