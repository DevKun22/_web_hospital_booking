import assert from "node:assert/strict";
import test from "node:test";

import { nluResultSchema } from "../../src/services/chatbot/ai/nlu.schema.js";
import { CHAT_OPERATIONS } from "../../src/services/chatbot/chatbot.types.js";
import { startTimeOfPeriod } from "../../src/services/chatbot/chatbot.context.js";
import { decideSessionBinding } from "../../src/services/chatbot/chatbot.session.js";
import { preferredTimeReply } from "../../src/services/chatbot/flows/booking.builders.js";
import { emergencyOutput, resumeBookingAction } from "../../src/services/chatbot/flows/system.replies.js";
import { INTENT_SPECS, intentPromptSection, intentSpecOf } from "../../src/services/chatbot/intent/intent.spec.js";
import { parseVietnameseDateTime } from "../../src/services/chatbot/nlu/datetime.parser.js";
import { bookingScheduleDoc } from "../../src/services/chatbot/rag/chunker.js";
import { numbersAreGrounded } from "../../src/services/chatbot/rag/generator.js";
import { routeByHeuristics } from "../../src/services/chatbot/router/route.js";
import { hasEmergencySignal } from "../../src/services/chatbot/rules/emergency-detector.js";
import type { ChatbotContext } from "../../src/services/chatbot/chatbot.context.js";

// 2026-11-25 là thứ tư.
const TODAY = "2026-11-25";

test("ngày giờ tiếng Việt: các cách nói thường gặp", () => {
  const cases: [string, ReturnType<typeof parseVietnameseDateTime>][] = [
    ["ngày mai", { date: "2026-11-26" }],
    ["ngày kia", { date: "2026-11-27" }],
    ["hôm nay còn lịch không", { date: TODAY }],
    ["thứ hai tuần sau", { date: "2026-11-30" }],
    ["chủ nhật tuần sau", { date: "2026-12-06" }],
    ["thứ năm", { date: "2026-11-26" }],
    ["9 giờ sáng", { preferredTime: "09:00", timePeriod: "MORNING" }],
    ["9h", { preferredTime: "09:00", timePeriod: "MORNING" }],
    ["9h30", { preferredTime: "09:30", timePeriod: "MORNING" }],
    ["9 giờ rưỡi", { preferredTime: "09:30", timePeriod: "MORNING" }],
    ["2 giờ chiều mai", { date: "2026-11-26", preferredTime: "14:00", timePeriod: "AFTERNOON" }],
    ["buổi chiều", { timePeriod: "AFTERNOON" }],
    ["sáng mai", { date: "2026-11-26", timePeriod: "MORNING" }],
    ["tối mai 7h", { date: "2026-11-26", preferredTime: "19:00", timePeriod: "EVENING" }],
    ["chiều nay 14:30", { date: TODAY, preferredTime: "14:30", timePeriod: "AFTERNOON" }],
    ["ngày 3 tháng 12", { date: "2026-12-03" }],
    ["thu 6 tuan toi 8h30 sang", { date: "2026-12-04", preferredTime: "08:30", timePeriod: "MORNING" }],
  ];
  for (const [message, expected] of cases) assert.deepEqual(parseVietnameseDateTime(message, TODAY), expected, message);
});

test("ngày giờ: không bắt nhầm tên người, mã lịch, chữ 'sang'", () => {
  assert.deepEqual(parseVietnameseDateTime("bác sĩ Mai khám khoa nào", TODAY), {});
  assert.deepEqual(parseVietnameseDateTime("tra cứu BK20261124123456", TODAY), {});
  // "đổi sang" không phải buổi sáng.
  assert.equal(parseVietnameseDateTime("đổi sang thứ năm", TODAY).timePeriod, undefined);
  // Ngày đã qua trong năm, không nêu năm: hiểu là năm sau.
  assert.equal(parseVietnameseDateTime("20/11", TODAY).date, "2027-11-20");
  assert.deepEqual(parseVietnameseDateTime("31/02", TODAY), {});
});

test("đặc tả ý định phủ đủ mọi thao tác và lời nhắc AI dựng từ đó", () => {
  const specified = new Set(INTENT_SPECS.map((spec) => spec.operation));
  for (const operation of CHAT_OPERATIONS) {
    assert.ok(specified.has(operation), operation);
    assert.ok(intentPromptSection().includes(`- ${operation}:`), operation);
  }
  assert.equal(INTENT_SPECS.length, CHAT_OPERATIONS.length);
  // Thao tác thay đổi dữ liệu và xem lịch cá nhân luôn cần đăng nhập.
  for (const spec of INTENT_SPECS) if (spec.mutates || spec.handler === "APPOINTMENT") assert.equal(spec.requiresAuth, true, spec.operation);
  assert.equal(intentSpecOf("CANCEL_APPOINTMENT").handler, "APPOINTMENT");
  assert.equal(intentSpecOf("ASK_POLICY").handler, "INFO");
});

test("kết quả AI: giờ sai dạng bị bỏ, thao tác lạ thành UNKNOWN, có thao tác thứ hai", () => {
  const parsed = nluResultSchema.parse({
    operation: "LAM_GI_DO",
    secondaryOperation: "START_BOOKING",
    entities: { preferredTime: "25:99", date: "ngày mai", appointmentRef: "lịch ngày mai" },
    confidence: 0.9,
  });
  assert.equal(parsed.operation, "UNKNOWN");
  assert.equal(parsed.secondaryOperation, "START_BOOKING");
  assert.equal(parsed.entities.preferredTime, null);
  assert.equal(parsed.entities.date, null);
  assert.equal(parsed.entities.appointmentRef, "lịch ngày mai");
});

test("gắn phiên với tài khoản: chống cố định phiên và lẫn ngữ cảnh giữa tài khoản", () => {
  const future = new Date(Date.now() + 3_600_000);
  const past = new Date(Date.now() - 1000);
  const guest = { userId: null, expiresAt: future, isActive: true };
  const owned = { userId: "user-a", expiresAt: future, isActive: true };
  assert.equal(decideSessionBinding(null, null), "CREATE");
  assert.equal(decideSessionBinding({ ...guest, expiresAt: past }, null), "CREATE");
  assert.equal(decideSessionBinding({ ...guest, isActive: false }, { userId: "user-a" }), "CREATE");
  assert.equal(decideSessionBinding(guest, null), "REUSE");
  assert.equal(decideSessionBinding(guest, { userId: "user-a" }), "ROTATE_ON_LOGIN");
  assert.equal(decideSessionBinding(owned, { userId: "user-a" }), "REUSE");
  // Mã phiên của người khác không phải bằng chứng danh tính: tài khoản khác hoặc khách đều nhận phiên mới.
  assert.equal(decideSessionBinding(owned, { userId: "user-b" }), "DETACH");
  assert.equal(decideSessionBinding(owned, null), "DETACH");
});

test("đường lùi khi không có AI: chỉ bắt yêu cầu rõ về lịch của chính mình", () => {
  assert.equal(routeByHeuristics("hủy lịch hẹn giúp tôi"), "CANCEL_APPOINTMENT");
  assert.equal(routeByHeuristics("tôi muốn đổi lịch khám"), "RESCHEDULE_APPOINTMENT");
  assert.equal(routeByHeuristics("xem lịch hẹn của tôi"), "LOOKUP_APPOINTMENT");
  assert.equal(routeByHeuristics("BK20261124123456"), "LOOKUP_APPOINTMENT");
  // Câu hỏi quy định chung đi kho tri thức.
  assert.equal(routeByHeuristics("hủy lịch trước bao lâu"), null);
  assert.equal(routeByHeuristics("đổi lịch có mất phí không"), null);
  assert.equal(routeByHeuristics("gói khám tổng quát giá bao nhiêu"), null);
});

test("kiểm số liệu câu trả lời RAG", () => {
  const source = ["Gói Tim Mạch giá 1.250.000 đồng. Giờ làm việc 07:00–17:00. Hotline 1900 1234."];
  assert.equal(numbersAreGrounded("Gói này giá 1.250.000 đồng, mở cửa từ 07:00.", source), true);
  assert.equal(numbersAreGrounded("Gói này giá 1.300.000 đồng.", source), false);
  assert.equal(numbersAreGrounded("Bạn gọi 1900 1234 nhé.", source), true);
  assert.equal(numbersAreGrounded("Mở cửa đến 20:00.", source), false);

  // Số một chữ số đi với đơn vị (giờ khóa hủy, giờ mở cửa) cũng phải có trong nguồn; số đứng riêng thì không kiểm.
  const policy = ["Người khám tự hủy lịch được cho đến 2 giờ trước giờ khám. Giờ làm việc 7:00–17:00."];
  assert.equal(numbersAreGrounded("Bạn tự hủy được trước 2 giờ.", policy), true);
  assert.equal(numbersAreGrounded("Bạn tự hủy được trước 3 giờ.", policy), false);
  assert.equal(numbersAreGrounded("Mở cửa lúc 7h.", policy), true);
  assert.equal(numbersAreGrounded("Mở cửa lúc 8h.", policy), false);
  assert.equal(numbersAreGrounded("Mở cửa từ 07:00.", policy), true);
  assert.equal(numbersAreGrounded("Có 2 cách đặt lịch.", policy), true);
});

test("cấp cứu: luôn có 115, kèm số của cơ sở khi có; sửa lỗi ranh giới chữ", () => {
  const withHotline = emergencyOutput({}, "1900 9999");
  assert.match(withHotline.reply, /115/);
  assert.match(withHotline.reply, /1900 9999/);
  assert.ok(withHotline.suggestedActions.some((action) => action.payload.phone === "115"));
  assert.match(emergencyOutput({}).reply, /115/);
  // Trước đây chuỗi ranh giới mất dấu gạch chéo nên "ngấtngây" bị coi là cấp cứu.
  assert.equal(hasEmergencySignal("ngấtngây"), false);
  assert.equal(hasEmergencySignal("mẹ tôi bị ngất"), true);
});

test("lọc buổi ở truy vấn DB và trả lời giờ cụ thể", () => {
  assert.deepEqual(startTimeOfPeriod("MORNING"), { lt: "12:00" });
  assert.deepEqual(startTimeOfPeriod("AFTERNOON"), { gte: "12:00", lt: "18:00" });
  assert.deepEqual(startTimeOfPeriod(undefined), {});

  const context = {
    departments: [],
    packages: [],
    doctors: [],
    availableSlots: [
      { id: "s1", doctorId: "d1", date: "2026-11-26", startTime: "09:00", endTime: "09:30" },
      { id: "s2", doctorId: "d1", date: "2026-11-26", startTime: "08:30", endTime: "09:00" },
    ],
  } satisfies ChatbotContext;
  const exact = preferredTimeReply(context, { date: "2026-11-26", preferredTime: "09:00" });
  assert.match(exact || "", /Khung 09:00 ngày 26\/11\/2026 còn trống/);
  assert.match(exact || "", /chỉ được giữ sau bước đó/);
  const near = preferredTimeReply(context, { date: "2026-11-26", preferredTime: "10:00" });
  assert.match(near || "", /Không còn khung đúng 10:00/);
  assert.equal(preferredTimeReply(context, { date: "2026-11-26" }), null);
});

test("đổi chủ đề giữa lúc đặt lịch luôn có nút quay lại", () => {
  assert.deepEqual(resumeBookingAction({}), []);
  assert.equal(resumeBookingAction({ departmentId: "x" })[0].type, "RESUME_BOOKING");
});

test("tri thức lịch khám tách khỏi giờ làm việc, nói rõ ngày không nhận đặt online", () => {
  const doc = bookingScheduleDoc([
    { dayOfWeek: 1, startTime: "07:30", endTime: "11:30" },
    { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" },
    { dayOfWeek: 6, startTime: "07:30", endTime: "11:30" },
  ]);
  assert.ok(doc);
  assert.match(doc!.content, /Thứ hai \(07:30–17:00\)/);
  assert.match(doc!.content, /Chủ nhật: không có lịch khám đặt online|Chủ nhật.*không có lịch khám đặt online/);
  assert.equal(bookingScheduleDoc([]), null);
});
