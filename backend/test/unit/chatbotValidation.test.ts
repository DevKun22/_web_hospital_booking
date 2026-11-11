import assert from "node:assert/strict";
import test from "node:test";

import { chatbotMessageSchema } from "../../src/validations/chatbot.validation.js";

test("chatbot accepts normal messages and bounded action payloads", () => {
  assert.equal(
    chatbotMessageSchema.safeParse({
      message: "Tôi muốn tìm bác sĩ tim mạch",
      action: { type: "VIEW_DEPARTMENTS", payload: { source: "chat" } },
    }).success,
    true,
  );
});

test("chatbot rejects oversized text and nested action payloads", () => {
  assert.equal(
    chatbotMessageSchema.safeParse({ message: "x".repeat(2_001) }).success,
    false,
  );
  assert.equal(
    chatbotMessageSchema.safeParse({
      message: "Đặt lịch",
      draft: { reason: "x".repeat(501) },
    }).success,
    false,
  );
  assert.equal(
    chatbotMessageSchema.safeParse({
      message: "Đặt lịch",
      action: { type: "BOOKING_START", payload: { value: "x".repeat(4_096) } },
    }).success,
    false,
  );
});
