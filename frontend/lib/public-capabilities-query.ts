"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type OtpChannel = "SMS" | "EMAIL";

export type PublicCapabilities = {
  otp: { channels: OtpChannel[]; defaultChannel: OtpChannel };
  payment: { enabled: boolean; supportedProviders: string[] };
};

// Kênh OTP/thanh toán đang bật trên backend; dùng để ẩn lựa chọn không khả dụng.
export function usePublicCapabilities() {
  return useQuery({
    queryKey: ["public", "capabilities"],
    queryFn: () => apiRequest<PublicCapabilities>("/v1/capabilities"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
