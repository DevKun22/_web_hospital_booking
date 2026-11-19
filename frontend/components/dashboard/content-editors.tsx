"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { DsButton, DsInput, DsTextarea } from "@/components/ds";
import type { ContentSection, FaqEntry, TimelineEntry } from "@/lib/types";

// Bộ soạn danh sách dùng chung cho nội dung công khai của chuyên khoa, gói khám, bác sĩ. Mỗi bộ soạn chỉ nắm danh sách trong bộ nhớ;
// trước khi gửi máy chủ, dùng các hàm clean* để bỏ dòng trống và cắt khoảng trắng.

type RowControlsProps = { index: number; count: number; label: string; disabled?: boolean; onMove: (from: number, to: number) => void; onRemove: (index: number) => void };

function RowControls({ index, count, label, disabled, onMove, onRemove }: RowControlsProps) {
  return (
    <span style={{ display: "inline-flex", gap: 4, flex: "none" }}>
      <DsButton icon variant="ghost" aria-label={`Chuyển ${label} lên`} disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp size={16} aria-hidden="true" />
      </DsButton>
      <DsButton icon variant="ghost" aria-label={`Chuyển ${label} xuống`} disabled={disabled || index === count - 1} onClick={() => onMove(index, index + 1)}>
        <ArrowDown size={16} aria-hidden="true" />
      </DsButton>
      <DsButton icon variant="ghost" aria-label={`Xóa ${label}`} disabled={disabled} onClick={() => onRemove(index)}>
        <Trash2 size={16} aria-hidden="true" />
      </DsButton>
    </span>
  );
}

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
const replaceAt = <T,>(list: T[], index: number, value: T) => list.map((item, position) => (position === index ? value : item));
const without = <T,>(list: T[], index: number) => list.filter((_, position) => position !== index);

type ListShellProps = { label: string; hint?: string; count: number; max: number; addLabel: string; disabled?: boolean; onAdd: () => void; children: React.ReactNode };

function ListShell({ label, hint, count, max, addLabel, disabled, onAdd, children }: ListShellProps) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      <legend className="ds-label" style={{ padding: 0 }}>{label}</legend>
      {hint ? <p className="ds-hint" style={{ margin: 0 }}>{hint}</p> : null}
      {children}
      <div>
        <DsButton disabled={disabled || count >= max} onClick={onAdd}>
          <Plus size={16} aria-hidden="true" /> {addLabel}
        </DsButton>
        <span className="ds-hint" style={{ marginLeft: 8 }}>{count}/{max}</span>
      </div>
    </fieldset>
  );
}

const rowStyle = { display: "flex", gap: 8, alignItems: "flex-start" } as const;
const cardStyle = { border: "1px solid var(--ds-line)", borderRadius: 8, padding: 10, display: "grid", gap: 8 } as const;

export function StringListEditor({ id, label, hint, values, onChange, max = 12, placeholder, addLabel = "Thêm dòng", itemLabel = "dòng", disabled }: {
  id: string; label: string; hint?: string; values: string[]; onChange: (next: string[]) => void; max?: number; placeholder?: string; addLabel?: string; itemLabel?: string; disabled?: boolean;
}) {
  return (
    <ListShell label={label} hint={hint} count={values.length} max={max} addLabel={addLabel} disabled={disabled} onAdd={() => onChange([...values, ""])}>
      {values.map((value, index) => (
        <div key={index} style={rowStyle}>
          <DsInput id={`${id}-${index}`} aria-label={`${label}, ${itemLabel} ${index + 1}`} value={value} maxLength={200} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(replaceAt(values, index, event.target.value))} />
          <RowControls index={index} count={values.length} label={`${itemLabel} ${index + 1}`} disabled={disabled} onMove={(from, to) => onChange(move(values, from, to))} onRemove={(position) => onChange(without(values, position))} />
        </div>
      ))}
    </ListShell>
  );
}

export function SectionsEditor({ id, values, onChange, max = 8, disabled }: { id: string; values: ContentSection[]; onChange: (next: ContentSection[]) => void; max?: number; disabled?: boolean }) {
  return (
    <ListShell label="Nội dung giới thiệu theo mục" hint="Mỗi mục thành một đề mục có đường dẫn riêng trên trang công khai. Nội dung viết bằng Markdown. Mục để trống sẽ không hiển thị." count={values.length} max={max} addLabel="Thêm mục" disabled={disabled} onAdd={() => onChange([...values, { title: "", body: "" }])}>
      {values.map((section, index) => (
        <div key={index} style={cardStyle}>
          <div style={rowStyle}>
            <DsInput id={`${id}-title-${index}`} aria-label={`Tiêu đề mục ${index + 1}`} placeholder="Tiêu đề mục, ví dụ: Tổng quan" maxLength={80} value={section.title} disabled={disabled} onChange={(event) => onChange(replaceAt(values, index, { ...section, title: event.target.value }))} />
            <RowControls index={index} count={values.length} label={`mục ${index + 1}`} disabled={disabled} onMove={(from, to) => onChange(move(values, from, to))} onRemove={(position) => onChange(without(values, position))} />
          </div>
          <DsTextarea id={`${id}-body-${index}`} aria-label={`Nội dung mục ${index + 1}`} rows={5} maxLength={8000} value={section.body} disabled={disabled} onChange={(event) => onChange(replaceAt(values, index, { ...section, body: event.target.value }))} />
        </div>
      ))}
    </ListShell>
  );
}

export function TimelineEditor({ id, values, onChange, max = 12, disabled }: { id: string; values: TimelineEntry[]; onChange: (next: TimelineEntry[]) => void; max?: number; disabled?: boolean }) {
  return (
    <ListShell label="Quá trình công tác" hint="Giai đoạn, nơi công tác và vai trò (không bắt buộc), từ mới đến cũ hoặc theo thứ tự bạn muốn hiển thị." count={values.length} max={max} addLabel="Thêm mốc" disabled={disabled} onAdd={() => onChange([...values, { period: "", place: "", role: "" }])}>
      {values.map((entry, index) => (
        <div key={index} style={{ ...cardStyle, gridTemplateColumns: "minmax(0,1fr)" }}>
          <div style={rowStyle}>
            <DsInput id={`${id}-period-${index}`} aria-label={`Giai đoạn, mốc ${index + 1}`} placeholder="Giai đoạn: 2010 - 2015" maxLength={40} value={entry.period} disabled={disabled} onChange={(event) => onChange(replaceAt(values, index, { ...entry, period: event.target.value }))} style={{ maxWidth: 180 }} />
            <DsInput id={`${id}-place-${index}`} aria-label={`Nơi công tác, mốc ${index + 1}`} placeholder="Nơi công tác" maxLength={160} value={entry.place} disabled={disabled} onChange={(event) => onChange(replaceAt(values, index, { ...entry, place: event.target.value }))} />
            <RowControls index={index} count={values.length} label={`mốc ${index + 1}`} disabled={disabled} onMove={(from, to) => onChange(move(values, from, to))} onRemove={(position) => onChange(without(values, position))} />
          </div>
          <DsInput id={`${id}-role-${index}`} aria-label={`Vai trò, mốc ${index + 1}`} placeholder="Vai trò (không bắt buộc)" maxLength={120} value={entry.role ?? ""} disabled={disabled} onChange={(event) => onChange(replaceAt(values, index, { ...entry, role: event.target.value }))} />
        </div>
      ))}
    </ListShell>
  );
}

export function FaqEditor({ id, values, onChange, max = 10, disabled }: { id: string; values: FaqEntry[]; onChange: (next: FaqEntry[]) => void; max?: number; disabled?: boolean }) {
  return (
    <ListShell label="Hỏi đáp về gói" hint="Câu hỏi người khám thường hỏi trước khi đặt gói. Hiện thành mục mở rộng trên trang gói khám." count={values.length} max={max} addLabel="Thêm câu hỏi" disabled={disabled} onAdd={() => onChange([...values, { question: "", answer: "" }])}>
      {values.map((entry, index) => (
        <div key={index} style={cardStyle}>
          <div style={rowStyle}>
            <DsInput id={`${id}-q-${index}`} aria-label={`Câu hỏi ${index + 1}`} placeholder="Câu hỏi" maxLength={200} value={entry.question} disabled={disabled} onChange={(event) => onChange(replaceAt(values, index, { ...entry, question: event.target.value }))} />
            <RowControls index={index} count={values.length} label={`câu hỏi ${index + 1}`} disabled={disabled} onMove={(from, to) => onChange(move(values, from, to))} onRemove={(position) => onChange(without(values, position))} />
          </div>
          <DsTextarea id={`${id}-a-${index}`} aria-label={`Trả lời ${index + 1}`} rows={3} maxLength={2000} value={entry.answer} disabled={disabled} onChange={(event) => onChange(replaceAt(values, index, { ...entry, answer: event.target.value }))} />
        </div>
      ))}
    </ListShell>
  );
}

export const cleanStrings = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);
export const cleanSections = (values: ContentSection[]) =>
  values.map((item) => ({ title: item.title.trim(), body: item.body.trim() })).filter((item) => item.title && item.body);
export const cleanTimeline = (values: TimelineEntry[]) =>
  values
    .map((item) => ({ period: item.period.trim(), place: item.place.trim(), ...(item.role?.trim() ? { role: item.role.trim() } : {}) }))
    .filter((item) => item.period && item.place);
export const cleanFaq = (values: FaqEntry[]) =>
  values.map((item) => ({ question: item.question.trim(), answer: item.answer.trim() })).filter((item) => item.question && item.answer);
