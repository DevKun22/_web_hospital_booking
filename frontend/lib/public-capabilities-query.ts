"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type PublicCapabilities = {
  // OTP chỉ gửi qua email; false khi chưa cấu hình dịch vụ gửi thư.
  otp: { emailOtpAvailable: boolean };
  payment: { enabled: boolean; supportedProviders: string[] };
};

// Khả năng OTP/thanh toán đang bật trên backend; dùng để ẩn lựa chọn không khả dụng.
export function usePublicCapabilities() {
  return useQuery({
    queryKey: ["public", "capabilities"],
    queryFn: () => apiRequest<PublicCapabilities>("/capabilities"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
