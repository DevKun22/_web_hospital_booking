"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

// Điều khoản và chính sách bảo mật do cơ sở khám soạn. Chưa soạn (null) thì giao diện không hiện ô đồng ý và máy chủ không đòi.
export type LegalDoc = { title: string; body: string; version: string; updatedAt: string };
export type LegalDocuments = { terms: LegalDoc | null; privacy: LegalDoc | null };

export const legalQueryKey = ["public", "legal"] as const;

export function useLegal() {
  return useQuery({
    queryKey: legalQueryKey,
    queryFn: () => apiRequest<LegalDocuments>("/legal"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export const TERMS_REQUIRED_MESSAGE = "Vui lòng đọc và đồng ý Điều khoản sử dụng trước khi nhận mã OTP.";

// Phần gửi kèm yêu cầu OTP: rỗng khi chưa có điều khoản.
export const termsPayload = (terms: LegalDoc | null | undefined, accepted: boolean) =>
  terms ? { termsAccepted: accepted, termsVersion: terms.version } : {};
