import assert from "node:assert/strict";
import test from "node:test";

import { chatbotReplies } from "../../src/services/chatbot/chatbot.responses.js";
import { policyActions } from "../../src/services/chatbot/flows/follow-up.js";
import { nearbyQuestionActions, noInformationOutput } from "../../src/services/chatbot/flows/info.flow.js";
import { fallbackOutput, greetingOutput } from "../../src/services/chatbot/flows/system.replies.js";
import type { KnowledgeChunk, RetrievedChunk } from "../../src/services/chatbot/rag/rag.types.js";

// Giọng của Kun: xưng "mình/bạn", nói chủ động, không nhắc "hệ thống", không ví dụ ngày dạng máy.
const MECHANICAL = /hệ thống|đã được (chọn|ghi nhận)|\b20\d\d-\d\d-\d\d\b/i;

const everyTemplate = (): string[] => {
  const out: string[] = [chatbotReplies.changeDatePrompt, chatbotReplies.triageNoMatch, chatbotReplies.noMatchingDoctorOrSlot];
  for (const name of [undefined, "BS. An"]) {
    out.push(chatbotReplies.departmentSelected(name), chatbotReplies.packageSelected(name), chatbotReplies.packageSelectedWithSlots(name));
    out.push(chatbotReplies.doctorSelectedWithSlots(name), chatbotReplies.doctorSelectedNoSlots(name), chatbotReplies.departmentSuggestion(name));
  }
  for (const flag of [true, false]) {
    out.push(chatbotReplies.packageList(flag), chatbotReplies.doctorChange(flag), chatbotReplies.packageSuggestion(flag));
    out.push(chatbotReplies.noDoctorSlots(flag), chatbotReplies.chooseDoctorForSlots(flag));
  }
  out.push(chatbotReplies.doctorSlotFoundAfterDateMiss("12/6", "14/6"), chatbotReplies.slotLookupAfterDateMiss("12/6", "14/6"));
  out.push(chatbotReplies.triageMatched("Tim mạch", "mô tả"), chatbotReplies.triageFallback("Khoa tổng quát"), chatbotReplies.triageClarification("Bạn đau từ bao giờ?"));
  // Câu có `vary()` chọn ngẫu nhiên: lấy nhiều lần để chạm mọi biến thể.
  for (let i = 0; i < 40; i += 1) {
    out.push(
      chatbotReplies.departmentListGuide,
      chatbotReplies.slotSelected,
      chatbotReplies.readyToBook,
      chatbotReplies.doctorSlotsFound,
      chatbotReplies.nearestSlotsFound,
    );
  }
  return out;
};

test("mọi câu mẫu của Kun dùng một giọng: không nhắc hệ thống, không câu bị động, không ngày dạng máy", () => {
  for (const text of everyTemplate()) assert.doesNotMatch(text, MECHANICAL, text);
});

test("câu chào, dự phòng và chưa có thông tin cùng giọng", () => {
  const draft = {};
  const texts: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    texts.push(greetingOutput(draft).reply, fallbackOutput(draft, false).reply, noInformationOutput(draft).reply, noInformationOutput(draft, [{ type: "ASK_QUESTION", label: "x", payload: {} }]).reply);
  }
  for (const text of texts) assert.doesNotMatch(text, MECHANICAL, text);
});

test("câu chọn khung giờ luôn nói rõ chưa giữ chỗ", () => {
  for (let i = 0; i < 40; i += 1) assert.match(chatbotReplies.slotSelected, /chưa giữ chỗ|CHƯA được giữ chỗ/);
});

test("nút gợi ý theo chủ đề câu hỏi chính sách", () => {
  const cancel = policyActions("Tự hủy lịch trước mấy tiếng?");
  assert.equal(cancel[0].label, "Hủy lịch của tôi");
  assert.equal(cancel[0].type, "ASK_QUESTION");
  assert.ok(cancel.some((action) => action.type === "LOOKUP_APPOINTMENT"));
  assert.ok(!cancel.some((action) => action.type === "START_BOOKING"), "hỏi về hủy lịch thì không mời đặt lịch ngay");

  assert.equal(policyActions("hoàn tiền thế nào")[0].label, "Hủy lịch của tôi");
  assert.equal(policyActions("Thanh toán bằng thẻ ngân hàng được không?")[0].type, "VIEW_PACKAGES");
  // Chủ đề khác và không có câu hỏi: giữ bộ mặc định.
  assert.equal(policyActions("quy định đặt lịch")[0].type, "START_BOOKING");
  assert.equal(policyActions("")[0].type, "START_BOOKING");
});

const retrieved = (id: string, sourceType: KnowledgeChunk["sourceType"], title: string, coverage: number, similarity: number | null = null): RetrievedChunk => ({
  chunk: { id, sourceId: id, url: null, embedding: null, sourceType, title, content: title },
  score: 1,
  coverage,
  similarity,
});

test("chưa có câu trả lời thì gợi ý tối đa hai câu hỏi thường gặp đủ gần, không gợi ý lạc đề", () => {
  const nearby = nearbyQuestionActions([
    retrieved("f1", "FAQ", "Tôi có thể trả tiền bằng thẻ ngân hàng không?", 0.5),
    retrieved("d1", "DOCTOR", "BS. An", 0.9),
    retrieved("f2", "FAQ", "Cần mang theo giấy tờ gì khi đi khám?", 0.1, 0.6),
    retrieved("f3", "FAQ", "Giờ làm việc của cơ sở khám?", 0.5),
    retrieved("f4", "FAQ", "Câu lạc đề", 0.05, 0.2),
  ]);
  assert.deepEqual(nearby.map((action) => action.payload.question), ["Tôi có thể trả tiền bằng thẻ ngân hàng không?", "Cần mang theo giấy tờ gì khi đi khám?"]);
  assert.ok(nearby.every((action) => action.type === "ASK_QUESTION"));
  assert.deepEqual(nearbyQuestionActions([retrieved("f4", "FAQ", "Không liên quan", 0.05, 0.2)]), []);
});

test("nhãn gợi ý dài được rút gọn nhưng câu hỏi gửi đi giữ nguyên", () => {
  const long = "Nếu tôi lỡ không đến khám đúng giờ hẹn thì lịch của tôi có bị hủy và có mất phí gì không?";
  const [action] = nearbyQuestionActions([retrieved("f", "FAQ", long, 0.9)]);
  assert.ok(action.label.length <= 44);
  assert.ok(action.label.endsWith("…"));
  assert.equal(action.payload.question, long);
});

test("chưa có thông tin: câu gợi ý đứng trước các nút mặc định và tổng không quá 4 nút", () => {
  const nearby = [
    { type: "ASK_QUESTION" as const, label: "a", payload: { question: "a" } },
    { type: "ASK_QUESTION" as const, label: "b", payload: { question: "b" } },
  ];
  const output = noInformationOutput({}, nearby);
  assert.deepEqual(output.suggestedActions.slice(0, 2).map((action) => action.label), ["a", "b"]);
  assert.ok(output.suggestedActions.length <= 4);
  assert.match(output.reply, /bên dưới/);
  assert.equal(noInformationOutput({}).suggestedActions[0].type, "VIEW_DEPARTMENTS");
});

test("lỗi tạm thời của AI nói rõ là Kun đang bận và có nút Thử lại gửi lại đúng câu vừa hỏi", () => {
  const busy = fallbackOutput({}, true, "  Phí khám bao nhiêu?  ");
  assert.match(busy.reply, /bận/);
  assert.doesNotMatch(busy.reply, /chưa hiểu hết ý/);
  assert.deepEqual(busy.suggestedActions[0], { type: "ASK_QUESTION", label: "Thử lại", payload: { question: "Phí khám bao nhiêu?" } });

  // Không có câu để gửi lại thì không có nút Thử lại; Kun không hiểu ý (AI vẫn chạy) thì không nhận là "bận".
  assert.ok(!fallbackOutput({}, true).suggestedActions.some((action) => action.label === "Thử lại"));
  const unclear = fallbackOutput({}, false, "abc");
  assert.doesNotMatch(unclear.reply, /bận/);
  assert.ok(!unclear.suggestedActions.some((action) => action.label === "Thử lại"));
});
