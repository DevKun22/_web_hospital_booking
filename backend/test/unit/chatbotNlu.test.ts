import assert from "node:assert/strict";
import test from "node:test";

import { nluResultSchema } from "../../src/services/chatbot/ai/nlu.schema.js";

test("kết quả phân tích ý định bỏ giá trị lạ trong danh sách thay vì hỏng cả kết quả", () => {
  const parsed = nluResultSchema.parse({
    operation: "SEARCH_DEPARTMENT",
    entities: { symptoms: ["đau đầu"] },
    triage: { missingDetails: [0, "DURATION", "KHÔNG_CÓ", "SEVERITY"] },
    correction: { clearFields: ["doctor", "banana"] },
    confidence: 0.8,
  } as unknown);
  assert.deepEqual(parsed.triage.missingDetails, ["DURATION", "SEVERITY"]);
  assert.deepEqual(parsed.correction.clearFields, ["doctor"]);
});

test("ý định lạ quy về UNKNOWN và độ tin cậy sai quy về mức trung bình", () => {
  const parsed = nluResultSchema.parse({ operation: "FLY_TO_MOON", confidence: "cao" });
  assert.equal(parsed.operation, "UNKNOWN");
  assert.equal(parsed.confidence, 0.5);
});
