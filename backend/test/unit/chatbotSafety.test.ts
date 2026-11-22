import assert from "node:assert/strict";
import test from "node:test";

import { legalDocs } from "../../src/services/chatbot/rag/chunker.js";
import { isNoInformationOutput } from "../../src/services/chatbot/flows/info.flow.js";
import { hasEmergencySignal } from "../../src/services/chatbot/rules/emergency-detector.js";
import { maskPersonalData } from "../../src/services/chatbot/rules/pii-masker.js";
import { chatbotSessionKey } from "../../src/middlewares/publicRateLimits.js";

test("rào cấp cứu không bắt nhầm ngạt mũi, ngắt quãng", () => {
  for (const message of ["tôi bị ngạt mũi", "nghẹt mũi, ngạt thở nhẹ khi ngủ", "ngat mui ve dem", "ngắt quãng kết nối", "cuộc gọi bị ngắt", "đau bụng thường", "đau đầu nhẹ", "ho khan", "nôn nhẹ", "chảy máu cam nhẹ", "tử tế", "độc quyền", "đột nhiên mệt", "tôi bị đau lưng"]) {
    assert.equal(hasEmergencySignal(message.toLowerCase()), false, message);
  }
});

test("rào cấp cứu vẫn bắt ngất và các cụm đã có", () => {
  for (const message of ["bố tôi vừa bị ngất", "em bé ngất xỉu", "bi ngat roi", "đau ngực dữ dội", "co giat", "liệt nửa người", "ngất.", "tôi đau ngực", "khó thở", "ngừng thở", "bị đột quỵ", "méo miệng", "nôn ra máu", "ho ra máu", "ngộ độc thuốc", "tôi muốn tự tử", "tự làm hại bản thân", "chảy máu nhiều", "yeu liet nua nguoi", "kho tho ve dem"]) {
    assert.equal(hasEmergencySignal(message.toLowerCase()), true, message);
  }
});

test("che số điện thoại, email và số giấy tờ", () => {
  assert.equal(maskPersonalData("Số mình 0912 345 678 nhé"), "Số mình [số điện thoại] nhé");
  assert.equal(maskPersonalData("gọi +84 912-345-678 hoặc 0912345678"), "gọi [số điện thoại] hoặc [số điện thoại]");
  assert.equal(maskPersonalData("mail abc.d+x@gmail.com"), "mail [email]");
  assert.equal(maskPersonalData("cccd 012345678901"), "cccd [số giấy tờ]");
  assert.equal(maskPersonalData("Gói khám giá 2500000 đồng, 3 ngày"), "Gói khám giá 2500000 đồng, 3 ngày");
});

test("giới hạn theo phiên chỉ áp dụng khi có sessionId hợp lệ", () => {
  const id = "0b3f6a52-6f5b-4e9d-8a77-6c2d3d7f9a10";
  assert.equal(chatbotSessionKey({ body: { sessionId: id.toUpperCase() } }), id);
  assert.equal(chatbotSessionKey({ body: { sessionId: "abc" } }), null);
  assert.equal(chatbotSessionKey({ body: {} }), null);
  assert.equal(chatbotSessionKey({}), null);
});

test("điều khoản và chính sách bảo mật thành đoạn tri thức khi đã soạn; chưa soạn thì không có đoạn nào", () => {
  assert.deepEqual(legalDocs("terms", null), []);
  assert.deepEqual(legalDocs("privacy", { title: "Chính sách bảo mật", body: "  " }), []);
  const docs = legalDocs("privacy", { title: "Chính sách bảo mật", body: "## Dữ liệu thu thập\nChúng tôi thu thập email để gửi mã OTP." });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].sourceType, "LEGAL");
  assert.equal(docs[0].url, "/chinh-sach-bao-mat");
  assert.match(docs[0].content, /mã OTP/);
});

test("nhận ra câu trả lời chưa có thông tin để đo tỉ lệ", () => {
  const output = { reply: "x", intent: "GENERAL_HOSPITAL_INFO", state: "BOOKING_GUIDE", nextStep: "END", confidence: 0.3, draft: {}, suggestedActions: [] } as never;
  assert.equal(isNoInformationOutput(output, "SYSTEM"), true);
  assert.equal(isNoInformationOutput(output, "FALLBACK"), true);
  assert.equal(isNoInformationOutput(output, "AI"), false);
  assert.equal(isNoInformationOutput({ ...(output as object), confidence: 0.8 } as never, "SYSTEM"), false);
});
