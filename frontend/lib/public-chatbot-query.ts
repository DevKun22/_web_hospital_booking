"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ChatbotSettings } from "@/lib/types";

export const fetchPublicChatbotSettings = () =>
  apiRequest<ChatbotSettings>("/chatbot/settings");

export function usePublicChatbotSettings() {
  return useQuery({
    queryKey: queryKeys.publicChatbotSettings,
    queryFn: fetchPublicChatbotSettings,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
