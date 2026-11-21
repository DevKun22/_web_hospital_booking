"use client";

import Link from "next/link";
import { usePatientLookupLink } from "@/lib/patient-session-client";

// Liên kết tra cứu lịch hẹn ở chân trang: đổi theo phiên (đã đăng nhập thì vào thẳng lịch hẹn).
export function FooterLookupLink({ className }: { className: string }) {
  const lookup = usePatientLookupLink();
  return (
    <Link href={lookup.href} className={className}>
      {lookup.label}
    </Link>
  );
}
