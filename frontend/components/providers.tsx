"use client";

import { AuthProvider } from "@/lib/auth";
import { AppQueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/lib/theme";
import { PatientToastProvider } from "@/components/patient/patient-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppQueryProvider>
        <AuthProvider>
          <PatientToastProvider>{children}</PatientToastProvider>
        </AuthProvider>
      </AppQueryProvider>
    </ThemeProvider>
  );
}
