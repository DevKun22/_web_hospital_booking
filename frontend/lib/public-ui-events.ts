export const PUBLIC_CHATBOT_CLOSE_EVENT = "public-chatbot:close";
export const PUBLIC_CHATBOT_OPEN_EVENT = "public-chatbot:open";
export const PUBLIC_FLOATING_PANEL_VISIBILITY_EVENT =
  "public-floating-panel:visibility";

export function closePublicChatbot() {
  window.dispatchEvent(new Event(PUBLIC_CHATBOT_CLOSE_EVENT));
}

export function openPublicChatbot() {
  window.dispatchEvent(new Event(PUBLIC_CHATBOT_OPEN_EVENT));
}

export function setPublicFloatingPanelVisibility(visible: boolean) {
  window.dispatchEvent(
    new CustomEvent<boolean>(PUBLIC_FLOATING_PANEL_VISIBILITY_EVENT, {
      detail: visible,
    }),
  );
}
