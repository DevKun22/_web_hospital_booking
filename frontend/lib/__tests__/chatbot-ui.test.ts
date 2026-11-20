import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBookingHref,
  getBookingProgress,
  getKunTeaser,
  getNavigationTarget,
  getAskQuestion,
  getQuickReplies,
  getSourceReviewLine,
  getSelectionChips,
} from "../chatbot-ui";
import type { ChatbotDraftSummary, ChatbotResultGroup } from "../types";

const summary: ChatbotDraftSummary = {
  department: { id: "d1", name: "Khoa tổng quát" },
  doctor: { id: "doc1", name: "BS.CKII Nguyễn Minh Hùng", departmentName: "Khoa tổng quát", fee: 200000 },
  slot: { id: "s1", date: "2026-11-18", startTime: "09:30", endTime: "10:00" },
};

test("chưa chọn gì thì chưa có tiến trình để hiện", () => {
  assert.equal(getBookingProgress(undefined), null);
  assert.equal(getBookingProgress({}), null);
});

test("tiến trình đặt lịch: bước đang làm là bước đầu tiên chưa xong", () => {
  const onlyDepartment = getBookingProgress({ department: summary.department });
  assert.deepEqual(onlyDepartment?.steps.map((step) => step.done), [true, false, false, false]);
  assert.equal(onlyDepartment?.activeIndex, 1);

  const withDoctor = getBookingProgress({ department: summary.department, doctor: summary.doctor });
  assert.equal(withDoctor?.activeIndex, 2);

  // Đủ bác sĩ và giờ: chỉ còn bước xác nhận.
  assert.equal(getBookingProgress(summary)?.activeIndex, 3);
});

test("chọn bác sĩ trực tiếp (không qua khoa) vẫn tính bước khoa là xong", () => {
  const progress = getBookingProgress({ doctor: summary.doctor });
  assert.equal(progress?.steps[0].done, true);
});

test("thẻ lựa chọn theo thứ tự khoa, gói, bác sĩ, giờ và ghi ngày theo kiểu Việt Nam", () => {
  const chips = getSelectionChips({ ...summary, package: { id: "p1", name: "Gói cơ bản", price: 440000 } });
  assert.deepEqual(chips.map((chip) => chip.field), ["department", "package", "doctor", "slot"]);
  assert.equal(chips[3].label, "09:30, 18/11/2026");
  assert.deepEqual(getSelectionChips(undefined), []);
});

test("đường dẫn đặt lịch chỉ mang các giá trị có nội dung", () => {
  assert.equal(buildBookingHref(undefined), "/dat-lich");
  assert.equal(buildBookingHref({ departmentId: "d1", doctorId: " ", date: "2026-11-18", timeSlotId: "s1" }), "/dat-lich?departmentId=d1&date=2026-11-18&timeSlotId=s1");
  // Giá trị điền sẵn của nút ghi đè bản nháp.
  assert.equal(buildBookingHref({ doctorId: "a" }, { doctorId: "b" }), "/dat-lich?doctorId=b");
});

test("nút chuyển trang đi thẳng tới trang đích, nút khác thì để Kun xử lý", () => {
  assert.equal(getNavigationTarget({ type: "LOOKUP_APPOINTMENT", label: "", payload: {} }), "/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen");
  assert.equal(getNavigationTarget({ type: "CONTACT_STAFF", label: "", payload: {} }), "/ho-tro");
  assert.equal(getNavigationTarget({ type: "START_BOOKING", label: "", payload: { prefill: { doctorId: "b" } } }, { departmentId: "d1" }), "/dat-lich?departmentId=d1&doctorId=b");
  assert.equal(getNavigationTarget({ type: "VIEW_DEPARTMENTS", label: "", payload: {} }), null);
});

test("gợi ý nhanh bỏ nút trùng thẻ kết quả và nút cấp cứu, giữ tối đa bốn nút", () => {
  const action = (type: string) => ({ type, label: type, payload: {} });
  const results: ChatbotResultGroup[] = [{ type: "doctors", title: "", items: [], total: 0, limit: 0 }];
  const replies = getQuickReplies(
    [action("VIEW_DOCTOR"), action("EMERGENCY_ADVICE"), action("A"), action("B"), action("C"), action("D"), action("E")],
    results,
  );
  assert.deepEqual(replies.map((item) => item.type), ["A", "B", "C", "D"]);
});

test("tin nhắn nổi của Kun theo trang; im lặng ở trang đặt lịch, thanh toán và tài khoản", () => {
  assert.equal(getKunTeaser("/dat-lich"), null);
  assert.equal(getKunTeaser("/thanh-toan/abc"), null);
  assert.equal(getKunTeaser("/tai-khoan/lich-hen"), null);
  assert.match(getKunTeaser("/kien-thuc/an-uong")!.message, /bài viết này/);
  assert.match(getKunTeaser("/chuyen-khoa")!.message, /triệu chứng/);
  const home = getKunTeaser("/")!;
  assert.match(home.message, /Kun/);
  assert.ok(home.chips.length >= 1 && home.chips.every((chip) => chip.label));
});

test("nút hỏi thêm mang câu hỏi đầy đủ; nút khác hoặc câu rỗng thì không", () => {
  assert.equal(getAskQuestion({ type: "ASK_QUESTION", label: "Gói này gồm gì?", payload: { question: "  Gói Tổng Quát gồm những hạng mục nào?  " } }), "Gói Tổng Quát gồm những hạng mục nào?");
  assert.equal(getAskQuestion({ type: "ASK_QUESTION", label: "x", payload: { question: "  " } }), null);
  assert.equal(getAskQuestion({ type: "VIEW_PACKAGES", label: "Xem gói khám", payload: { question: "bỏ qua" } }), null);
});

test("dòng kiểm chứng của nguồn: có người duyệt, chỉ có ngày, hoặc không có gì; ngày tính theo giờ Việt Nam", () => {
  assert.equal(getSourceReviewLine({ reviewedBy: "TS.BS Trần Minh", updatedAt: "2026-11-12T03:00:00.000Z" }), "Duyệt bởi TS.BS Trần Minh · cập nhật 12/11/2026");
  assert.equal(getSourceReviewLine({ reviewedBy: null, updatedAt: "2026-11-12T03:00:00.000Z" }), "Cập nhật 12/11/2026");
  // 20h UTC ngày 11 đã là sáng ngày 12 tại Việt Nam.
  assert.equal(getSourceReviewLine({ updatedAt: "2026-11-11T20:00:00.000Z" }), "Cập nhật 12/11/2026");
  assert.equal(getSourceReviewLine({}), null);
  assert.equal(getSourceReviewLine({ updatedAt: "không phải ngày" }), null);
});
