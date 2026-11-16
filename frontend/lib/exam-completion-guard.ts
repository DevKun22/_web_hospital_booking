import type { ConfirmFn } from "@/components/ds";
import { apiRequest } from "@/lib/api";

type RecordLookup = {
  items: Array<{ diagnosis: string | null; treatment: string | null }>;
};

/** Hộp hỏi lại khi hồ sơ chưa có chẩn đoán hoặc hướng điều trị. Trả về true khi bác sĩ vẫn muốn hoàn thành. */
export const confirmCompleteWithoutConclusion = (bookingCode: string, confirm: ConfirmFn) =>
  confirm({
    title: "Hoàn thành khám khi chưa có kết luận?",
    message: `Lịch ${bookingCode} chưa có chẩn đoán hoặc hướng điều trị trong hồ sơ khám.`,
    confirmLabel: "Vẫn hoàn thành",
  });

/**
 * Cảnh báo mềm trước khi hoàn thành lịch khám: nếu chưa có hồ sơ hoặc hồ sơ chưa có
 * chẩn đoán/hướng điều trị thì hỏi lại bác sĩ. Không chặn: bác sĩ vẫn hoàn thành được.
 * Trả về true khi nên tiếp tục hoàn thành. Lỗi tra cứu không được cản việc hoàn thành.
 */
export async function confirmCompleteWithRecordCheck(bookingCode: string, confirm: ConfirmFn): Promise<boolean> {
  let missing = false;
  try {
    const result = await apiRequest<RecordLookup>("/dashboard/medical-records", {
      query: { q: bookingCode, limit: 1 },
    });
    const record = result.items[0];
    missing = !record || (!record.diagnosis?.trim() && !record.treatment?.trim());
  } catch {
    return true;
  }
  return missing ? confirmCompleteWithoutConclusion(bookingCode, confirm) : true;
}
