"use client";

import { X } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DashboardFeedback({
  error,
  notice,
  onDismiss,
}: {
  error?: string;
  notice?: string;
  onDismiss?: () => void;
}) {
  const message = error || notice;
  if (!message) return null;

  return (
    <div className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-md sm:right-6 sm:top-6">
      <Alert
        variant={error ? "destructive" : "default"}
        role={error ? "alert" : "status"}
        aria-live={error ? "assertive" : "polite"}
        className="bg-card px-4 py-3 shadow-lg"
      >
        <AlertTitle>{error ? "Có lỗi xảy ra" : "Thao tác thành công"}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        {onDismiss ? (
          <AlertAction>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Đóng thông báo">
              <X />
            </Button>
          </AlertAction>
        ) : null}
      </Alert>
    </div>
  );
}
