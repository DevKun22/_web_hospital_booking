import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";
import { PatientAuthProvider } from "@/lib/patient-auth";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Cổng thông tin người khám",
  description: "Quản lý lịch hẹn và hồ sơ chăm sóc sức khỏe cá nhân.",
});

export default function PatientAccountLayout({ children }: { children: React.ReactNode }) {
  return <PatientAuthProvider>{children}</PatientAuthProvider>;
}

