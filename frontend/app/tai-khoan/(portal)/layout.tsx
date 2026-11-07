import { PatientPortalShell } from "@/components/patient/patient-portal-shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PatientPortalShell>{children}</PatientPortalShell>;
}
