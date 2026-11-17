import { Send } from "lucide-react";
import { FormEvent, forwardRef, useState } from "react";

// Ô nhập tin. Cỡ chữ 16px trên điện thoại để iOS không tự phóng to khi chạm vào.
export const ChatComposer = forwardRef<HTMLInputElement, { placeholder: string; disabled?: boolean; sending?: boolean; onSend: (text: string) => void }>(
  function ChatComposer({ placeholder, disabled, sending, onSend }, ref) {
    const [text, setText] = useState("");
    const submit = (event: FormEvent) => {
      event.preventDefault();
      if (!text.trim() || sending) return;
      onSend(text);
      setText("");
    };

    return (
      <form className="flex gap-2 px-3 pb-3" onSubmit={submit}>
        <input
          ref={ref}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={500}
          className="ui-field min-w-0 flex-1 px-3 py-2 text-base disabled:bg-[var(--public-surface-muted)] disabled:text-[var(--public-muted)] sm:text-sm"
          aria-label="Nhập tin nhắn cho Kun"
        />
        <button
          type="submit"
          disabled={disabled || sending || !text.trim()}
          className="public-button-primary inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white transition active:scale-95 disabled:opacity-60"
          aria-label="Gửi"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    );
  },
);
