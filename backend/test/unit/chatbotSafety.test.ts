import assert from "node:assert/strict";
import test from "node:test";

import { hasEmergencySignal } from "../../src/services/chatbot/rules/emergency-detector.js";
import { maskPersonalData } from "../../src/services/chatbot/rules/pii-masker.js";
import { chatbotSessionKey } from "../../src/middlewares/publicRateLimits.js";

test("rào cấp cứu không bắt nhầm ngạt mũi, ngắt quãng", () => {
  for (const message of ["tôi bị ngạt mũi", "nghẹt mũi, ngạt thở nhẹ khi ngủ", "ngat mui ve dem", "ngắt quãng kết nối", "cuộc gọi bị ngắt"]) {
    assert.equal(hasEmergencySignal(message.toLowerCase()), false, message);
  }
});

test("rào cấp cứu vẫn bắt ngất và các cụm đã có", () => {
  for (const message of ["bố tôi vừa bị ngất", "em bé ngất xỉu", "bi ngat roi", "đau ngực dữ dội", "co giat", "liệt nửa người", "ngất."]) {
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
