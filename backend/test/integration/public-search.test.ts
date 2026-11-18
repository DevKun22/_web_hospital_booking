import { assert, http, prisma, test } from "./support/context.js";
import PublicSearchService from "../../src/services/search/search.service.js";

// Tìm kiếm công khai qua chỉ mục bộ nhớ: khớp không dấu và làm mới khi quản trị sửa nội dung.
const search = async (q: string, type = "all") => {
  const response = await http.request("/api/v1/search?q=" + encodeURIComponent(q) + "&type=" + type);
  assert.equal(response.status, 200);
  return response.body.data.items as { id: string; type: string; title: string }[];
};

test("search matches Vietnamese text without accents and respects the type filter", async () => {
  PublicSearchService.invalidateIndex();
  const department = await prisma.department.create({
    data: { name: "Tim mạch", slug: "tim-mach", description: "Khám các bệnh lý tim và mạch máu", symptomKeywords: ["đau ngực", "hồi hộp"] },
  });
  PublicSearchService.invalidateIndex();

  const unaccented = await search("tim mach", "department");
  assert.deepEqual(unaccented.map((item) => item.id), [department.id]);
  assert.ok((await search("dau nguc")).some((item) => item.id === department.id));
  assert.deepEqual(await search("tim mach", "doctor"), []);
  assert.deepEqual(await search("x"), []);
});

test("a content edit shows up after the index is invalidated, and inactive items are excluded", async () => {
  const department = await prisma.department.create({ data: { name: "Da liễu", slug: "da-lieu" } });
  PublicSearchService.invalidateIndex();
  assert.equal((await search("da lieu", "department")).length, 1);

  await prisma.department.update({ where: { id: department.id }, data: { isActive: false } });
  // Chưa làm mới thì còn kết quả cũ (chỉ mục sống tối đa TTL); sau khi đánh dấu hết hạn thì biến mất.
  PublicSearchService.invalidateIndex();
  assert.equal((await search("da lieu", "department")).length, 0);
});
