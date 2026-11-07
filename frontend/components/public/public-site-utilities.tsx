"use client";

import dynamic from "next/dynamic";
import { BackToTopButton } from "@/components/public/back-to-top-button";

const PublicChatbotWidget = dynamic(
  () =>
    import("@/components/public/public-chatbot-widget").then(
      (module) => module.PublicChatbotWidget,
    ),
  { ssr: false },
);

export function PublicSiteUtilities() {
  return (
    <>
      <BackToTopButton />
      <PublicChatbotWidget />
    </>
  );
}
