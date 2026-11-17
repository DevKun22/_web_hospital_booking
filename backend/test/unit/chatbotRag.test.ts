import assert from "node:assert/strict";
import test from "node:test";

import { contentHash, departmentDoc, doctorDoc, faqDoc, packageDoc, policyDoc, siteDoc } from "../../src/services/chatbot/rag/chunker.js";
import { composeTriageReply, answerFromSources, extractiveAnswer } from "../../src/services/chatbot/rag/generator.js";
import { normalizeVector } from "../../src/services/chatbot/rag/embedder.js";
import { KnowledgeIndex, tokenize } from "../../src/services/chatbot/rag/retriever.js";
import type { KnowledgeChunk, KnowledgeDoc, RetrievedChunk } from "../../src/services/chatbot/rag/rag.types.js";
import { routeByRules } from "../../src/services/chatbot/router/route.js";

const chunk = (id: string, doc: Omit<KnowledgeDoc, "sourceId" | "url">, embedding: number[] | null = null): KnowledgeChunk => ({
  id,
  sourceId: id,
  url: null,
  embedding,
  ...doc,
});

const corpus = [
  chunk("faq-fast", { sourceType: "FAQ", title: "Khám tổng quát có cần nhịn ăn không?", content: "Câu hỏi: Khám tổng quát có cần nhịn ăn không?\nTrả lời: Bạn nên nhịn ăn 8 giờ trước khi lấy máu xét nghiệm." }),
  chunk("pack-vip", { sourceType: "PACKAGE", title: "Gói khám sức khỏe tổng quát VIP", content: "Gói khám sức khỏe tổng quát VIP thuộc chuyên khoa Nội. Giá: 2.500.000 đồng. Hạng mục gồm: siêu âm bụng, điện tim." }),
  chunk("dept-tm", { sourceType: "DEPARTMENT", title: "Khoa tim mạch", content: "Chuyên khoa Khoa tim mạch. Triệu chứng, vấn đề thường gặp: đau ngực, hồi hộp, khó thở khi gắng sức." }),
  chunk("dept-da", { sourceType: "DEPARTMENT", title: "Da liễu", content: "Chuyên khoa Da liễu. Triệu chứng, vấn đề thường gặp: nổi mẩn, ngứa, mụn trứng cá." }),
];

test("tokenize bỏ dấu, bỏ từ đệm và giữ cụm hai từ", () => {
  const { words, all } = tokenize("Tôi muốn khám xét nghiệm máu");
  assert.deepEqual(words, ["kham", "xet", "nghiem", "mau"]);
  assert.ok(all.includes("xet_nghiem"));
});

test("truy hồi tìm theo từ và xếp đúng đoạn lên đầu", () => {
  const index = new KnowledgeIndex(corpus);
  const hits = index.search("gói khám tổng quát VIP giá bao nhiêu");
  assert.equal(hits[0].chunk.id, "pack-vip");
  assert.ok(hits.every((hit) => hit.similarity === null));
});

test("truy hồi lọc theo loại nguồn và trả rỗng khi câu hỏi không liên quan", () => {
  const index = new KnowledgeIndex(corpus);
  const onlyDepartments = index.search("đau ngực khó thở", { types: ["DEPARTMENT"] });
  assert.deepEqual(onlyDepartments.map((hit) => hit.chunk.id), ["dept-tm"]);
  assert.deepEqual(index.search("thời tiết hôm nay thế nào"), []);
});

test("truy hồi theo ngữ nghĩa bắt được câu không trùng từ khi có vector", () => {
  const withVectors = [
    chunk("a", { sourceType: "FAQ", title: "Nhịn ăn trước xét nghiệm", content: "Trả lời: Nên nhịn ăn 8 giờ." }, normalizeVector([1, 0.1, 0])),
    chunk("b", { sourceType: "FAQ", title: "Giờ làm việc", content: "Trả lời: Thứ hai đến thứ bảy." }, normalizeVector([0, 1, 0.2])),
  ];
  const index = new KnowledgeIndex(withVectors);
  assert.equal(index.embeddedCount, 2);
  // Câu hỏi không có từ nào trùng nhưng vector gần đoạn "a".
  const hits = index.search("để bụng đói trước khi lấy máu", { queryVector: normalizeVector([0.95, 0.15, 0]) });
  assert.equal(hits[0].chunk.id, "a");
  assert.ok((hits[0].similarity ?? 0) > 0.9);
});

const retrieved = (chunks: KnowledgeChunk[]): RetrievedChunk[] => chunks.map((item) => ({ chunk: item, score: 1, coverage: 1, similarity: null }));

test("sinh câu trả lời: chấp nhận khi nguồn hợp lệ và quy về mã đoạn thật", async () => {
  const answer = await answerFromSources({
    question: "Có cần nhịn ăn không?",
    chunks: retrieved(corpus.slice(0, 2)),
    generate: async () => JSON.stringify({ answerable: true, reply: "Bạn nên nhịn ăn 8 giờ trước khi lấy máu.", sources: ["S1"] }),
  });
  assert.deepEqual(answer, { reply: "Bạn nên nhịn ăn 8 giờ trước khi lấy máu.", sourceIds: ["faq-fast"] });
});

test("sinh câu trả lời: bỏ khi AI báo không đủ căn cứ, nêu nguồn lạ, không nêu nguồn hoặc trả sai định dạng", async () => {
  const ask = (text: string) =>
    answerFromSources({ question: "?", chunks: retrieved(corpus.slice(0, 2)), generate: async () => text });
  assert.equal(await ask(JSON.stringify({ answerable: false, reply: "", sources: [] })), null);
  assert.equal(await ask(JSON.stringify({ answerable: true, reply: "Giá 1 đồng.", sources: ["S9"] })), null);
  assert.equal(await ask(JSON.stringify({ answerable: true, reply: "Giá 1 đồng.", sources: ["S1", "S9"] })), null);
  assert.equal(await ask(JSON.stringify({ answerable: true, reply: "Giá 1 đồng.", sources: [] })), null);
  assert.equal(await ask("không phải JSON"), null);
});

test("sinh câu trả lời: lỗi gọi AI được ném ra để bên gọi dùng đường lùi", async () => {
  await assert.rejects(
    answerFromSources({
      question: "?",
      chunks: retrieved(corpus.slice(0, 1)),
      generate: async () => {
        throw new Error("timeout");
      },
    }),
    /timeout/,
  );
});

test("đường lùi lấy nguyên văn phần trả lời của FAQ", () => {
  const answer = extractiveAnswer(retrieved([corpus[0]]));
  assert.equal(answer?.reply, "Bạn nên nhịn ăn 8 giờ trước khi lấy máu xét nghiệm.");
  assert.deepEqual(answer?.sourceIds, ["faq-fast"]);
  assert.equal(extractiveAnswer([]), null);
});

test("diễn đạt gợi ý chuyên khoa phải giữ đúng tên khoa, nếu không dùng mẫu dự phòng", async () => {
  const base = { userMessage: "tôi đau ngực", verifiedData: {}, departmentName: "Khoa tim mạch", fallbackReply: "MẪU DỰ PHÒNG" };
  const good = await composeTriageReply({ ...base, generate: async () => JSON.stringify({ reply: "Bạn có thể bắt đầu tại Khoa tim mạch để thăm khám ban đầu." }) });
  assert.match(good, /Khoa tim mạch/);
  const wrongDepartment = await composeTriageReply({ ...base, generate: async () => JSON.stringify({ reply: "Bạn nên đến Khoa da liễu để thăm khám ban đầu nhé." }) });
  assert.equal(wrongDepartment, "MẪU DỰ PHÒNG");
  const failing = await composeTriageReply({ ...base, generate: async () => { throw new Error("down"); } });
  assert.equal(failing, "MẪU DỰ PHÒNG");
});

test("dựng đoạn tri thức: đủ thông tin nghiệp vụ và băm ổn định theo nội dung", () => {
  const faq = faqDoc({ id: "1", question: "Giờ làm việc?", answer: "7h đến 17h." });
  assert.match(faq.content, /Trả lời: 7h đến 17h\./);
  assert.equal(faq.url, "/hoi-dap");
  assert.equal(contentHash(faq), contentHash({ ...faq }));
  assert.notEqual(contentHash(faq), contentHash({ ...faq, content: `${faq.content} thêm` }));

  const dept = departmentDoc({ id: "d", name: "Nhi", slug: "khoa-nhi", description: "Khám trẻ em", triageDescription: null, symptomKeywords: ["sốt", "ho"] });
  assert.match(dept.content, /sốt, ho/);
  assert.equal(dept.url, "/chuyen-khoa/khoa-nhi");

  const doctor = doctorDoc({ id: "x", slug: "nguyen-minh-hung", title: "BS.CKII", specialization: "Nội tim mạch", bio: null, experience: 18, consultationFee: 200000, user: { fullName: "Nguyễn Minh Hùng" }, department: { name: "Khoa tổng quát" } });
  assert.equal(doctor.title, "BS.CKII Nguyễn Minh Hùng");
  assert.match(doctor.content, /18 năm/);
  assert.equal(doctor.url, "/bac-si/nguyen-minh-hung");

  const pack = packageDoc({ id: "p", name: "Gói A", slug: null, summary: null, description: null, note: null, basePrice: 800000, serviceFee: 50000, isBHYTSupport: true, department: null, items: [{ name: "Điện tim", included: true }, { name: "CT", included: false }] });
  assert.match(pack.content, /850\.000 đồng/);
  assert.equal(pack.url, null);
  assert.match(pack.content, /Điện tim/);
  assert.doesNotMatch(pack.content, /CT/);
  assert.match(pack.content, /bảo hiểm y tế/);
});

test("đoạn chính sách và liên hệ phản ánh cấu hình; thiếu thông tin liên hệ thì bỏ qua", () => {
  const policy = policyDoc({ bookingHoldMinutes: 10, reminderLeadMinutes: 180, patientCancelCutoffHours: 2 });
  assert.match(policy.content, /giữ 10 phút/);
  assert.match(policy.content, /2 giờ trước giờ khám/);
  assert.equal(siteDoc({ hospitalName: "DevKunCare" }), null);
  const site = siteDoc({ hospitalName: "DevKunCare", hotline: "1900 0000", address: "1 Đường A" });
  assert.match(site?.content ?? "", /1900 0000/);
});

test("định tuyến bằng quy tắc: chào, hỏi chức năng, làm lại không cần AI", () => {
  assert.equal(routeByRules("Xin chào!"), "GREETING");
  assert.equal(routeByRules("hi"), "GREETING");
  assert.equal(routeByRules("bạn làm được gì?"), "CAPABILITIES");
  assert.equal(routeByRules("làm lại từ đầu"), "RESET");
  assert.equal(routeByRules("chào bác sĩ Hùng cho tôi hỏi giá khám"), "NEEDS_NLU");
  assert.equal(routeByRules("tôi bị đau đầu 3 ngày"), "NEEDS_NLU");
});

test("câu hỏi tự nhiên nhiều từ đệm vẫn tìm được đoạn đúng nhờ trọng số từ hiếm", () => {
  const index = new KnowledgeIndex([
    ...corpus,
    chunk("policy", { sourceType: "POLICY", title: "Chính sách đặt lịch, hủy lịch và nhắc lịch", content: "Người khám tự hủy lịch được cho đến 2 giờ trước giờ khám; sau mốc này cần liên hệ nhân viên." }),
  ]);
  const hits = index.search("hủy lịch trong bao lâu thì được");
  assert.equal(hits[0]?.chunk.id, "policy");
});

test("đường lùi cho chuyên khoa nối thành một đoạn và kèm lưu ý không phải chẩn đoán", () => {
  const answer = extractiveAnswer(retrieved([corpus[2]]));
  assert.doesNotMatch(answer?.reply ?? "", /\n/);
  assert.match(answer?.reply ?? "", /không thay thế chẩn đoán/);
});

test("bộ nhớ đệm: hết hạn theo thời gian, theo phiên bản kho và loại mục cũ nhất khi đầy", async () => {
  const { TtlCache } = await import("../../src/services/chatbot/rag/ttl-cache.js");
  const cache = new TtlCache<string>(2, 30);
  cache.set("a", "1", 1);
  assert.equal(cache.get("a", 1), "1");
  assert.equal(cache.get("a", 2), undefined);

  cache.set("a", "1", 1);
  cache.set("b", "2", 1);
  cache.set("c", "3", 1);
  assert.equal(cache.get("a", 1), undefined);
  assert.equal(cache.get("c", 1), "3");

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(cache.get("c", 1), undefined);
});
