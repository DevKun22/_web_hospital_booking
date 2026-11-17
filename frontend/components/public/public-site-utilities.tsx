"use client";

import dynamic from "next/dynamic";
import { BackToTopButton } from "@/components/public/back-to-top-button";

const ChatbotWidget = dynamic(
  () =>
    import("@/components/chatbot/chatbot-widget").then(
      (module) => module.ChatbotWidget,
    ),
  { ssr: false },
);

export function PublicSiteUtilities() {
  return (
    <>
      <BackToTopButton />
      <ChatbotWidget />
    </>
  );
}
