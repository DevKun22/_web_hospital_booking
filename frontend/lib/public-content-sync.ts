const PUBLIC_CONTENT_UPDATED_KEY = "hospital-booking:public-content-updated";

export function publishPublicContentUpdated() {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    PUBLIC_CONTENT_UPDATED_KEY,
    String(Date.now()),
  );
}

export function subscribePublicContentUpdated(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === PUBLIC_CONTENT_UPDATED_KEY) callback();
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
