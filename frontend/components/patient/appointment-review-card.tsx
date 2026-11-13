"use client";

import { FormEvent, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { useAppointmentReview, useSubmitReview } from "@/features/portal/hooks";

const criteria = [
  { key: "doctorRating", label: "Bác sĩ" },
  { key: "serviceRating", label: "Dịch vụ" },
  { key: "facilityRating", label: "Cơ sở vật chất" },
] as const;

type Scores = Record<(typeof criteria)[number]["key"], number>;

function StarInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            aria-label={`${score} sao`}
            onClick={() => onChange(score)}
            className="rounded-md p-1"
          >
            <Star className={`h-6 w-6 ${score <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function AppointmentReviewCard({ appointmentId }: { appointmentId: string }) {
  const review = useAppointmentReview(appointmentId);
  const [scores, setScores] = useState<Scores>({ doctorRating: 0, serviceRating: 0, facilityRating: 0 });
  const [comment, setComment] = useState("");
  const submit = useSubmitReview(appointmentId);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit.mutate({ ...scores, comment: comment.trim() || null });
  };

  const isComplete = Object.values(scores).every((score) => score > 0);

  return (
    <section className="rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold">Đánh giá sau khám</h2>
      {review.isLoading ? (
        <p className="mt-4 text-sm text-[var(--public-muted)]">Đang tải...</p>
      ) : review.data ? (
        <div className="mt-4 space-y-2 text-sm">
          <p className="font-semibold">Bạn đã đánh giá {review.data.rating.toFixed(1)}/5. Cảm ơn bạn đã phản hồi.</p>
          {review.data.comment ? <p className="rounded-2xl bg-[var(--public-surface-muted)] p-4 text-[var(--public-text-soft)]">{review.data.comment}</p> : null}
        </div>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          {criteria.map((item) => (
            <StarInput
              key={item.key}
              label={item.label}
              value={scores[item.key]}
              onChange={(value) => setScores((current) => ({ ...current, [item.key]: value }))}
            />
          ))}
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Chia sẻ thêm trải nghiệm của bạn (không bắt buộc)"
            className="w-full rounded-2xl border border-[var(--public-border)] p-3 text-sm"
          />
          {submit.isError ? <p className="text-sm text-red-700">{submit.error instanceof Error ? submit.error.message : "Không thể gửi đánh giá."}</p> : null}
          <button
            type="submit"
            disabled={!isComplete || submit.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--public-primary)] px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Gửi đánh giá
          </button>
        </form>
      )}
    </section>
  );
}
