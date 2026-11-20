import type { ChatbotSuggestedAction } from "@/lib/types";

export const PUBLIC_CHATBOT_CLOSE_EVENT = "public-chatbot:close";
export const PUBLIC_CHATBOT_OPEN_EVENT = "public-chatbot:open";
export const PUBLIC_FLOATING_PANEL_VISIBILITY_EVENT =
  "public-floating-panel:visibility";

export function closePublicChatbot() {
  window.dispatchEvent(new Event(PUBLIC_CHATBOT_CLOSE_EVENT));
}

/** Mở khung chat Kun; kèm `start` thì gửi luôn yêu cầu đó (ví dụ nút "Tóm tắt với Kun" ở trang bài viết), khỏi bắt người dùng gõ. */
export function openPublicChatbot(start?: ChatbotSuggestedAction) {
  window.dispatchEvent(new CustomEvent<ChatbotSuggestedAction | undefined>(PUBLIC_CHATBOT_OPEN_EVENT, { detail: start }));
}

export function setPublicFloatingPanelVisibility(visible: boolean) {
  window.dispatchEvent(
    new CustomEvent<boolean>(PUBLIC_FLOATING_PANEL_VISIBILITY_EVENT, {
      detail: visible,
    }),
  );
}
