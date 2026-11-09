import * as React from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

// Nhãn, gợi ý và thông báo lỗi gắn với ô nhập qua id; ô nhập dùng `describedBy` để đọc cùng.
export function DsField({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("ds-field", className)}>
      <label className="ds-label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ds-req" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="ds-error" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="ds-hint" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// aria-describedby cho ô nhập đi cùng DsField.
export const describedBy = (id: string, state: { error?: string; hint?: string }) =>
  state.error ? `${id}-error` : state.hint ? `${id}-hint` : undefined;

export const DsInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function DsInput({ className, ...rest }, ref) {
    return <input ref={ref} className={cn("ds-input", className)} {...rest} />;
  },
);

export const DsSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function DsSelect({ className, ...rest }, ref) {
    return <select ref={ref} className={cn("ds-select", className)} {...rest} />;
  },
);

export const DsTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function DsTextarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn("ds-textarea", className)} {...rest} />;
  },
);
