import { assert, fixture, http, prisma, test } from "./support/context.js";

// Danh mục chuyên khoa công khai: số bác sĩ, số giờ trống và điểm đánh giá được đếm trong cơ sở dữ liệu, không kéo từng dòng về máy chủ.
// Các bài kiểm tra này khóa kết quả để việc tối ưu truy vấn không đổi số liệu người dùng thấy.

type CatalogItem = { id: string; doctorCount: number; availableSlotCount: number; reviewSummary: { count: number; averageRating: number } };

const catalogItem = async () => {
  const response = await http.request("/api/v1/departments/catalog?limit=24");
  assert.equal(response.status, 200);
  const item = (response.body.data.items as CatalogItem[]).find((row) => row.id === fixture.department.id);
  assert.ok(item, "chuyên khoa của fixture phải có trong danh mục");
  return item;
};

test("public-catalog: danh mục chuyên khoa đếm bác sĩ có giờ trống và số giờ trống còn đặt được", async () => {
  const item = await catalogItem();
  assert.equal(item.doctorCount, 1, "chỉ bác sĩ có giờ trống mới tính");
  assert.equal(item.availableSlotCount, 2);
  assert.deepEqual(item.reviewSummary, { count: 0, averageRating: 0 });
});

test("public-catalog: giờ đã có người đặt không còn tính là giờ trống", async () => {
  await prisma.doctorTimeSlot.update({ where: { id: fixture.slotOne.id }, data: { status: "BOOKED" } });
  assert.equal((await catalogItem()).availableSlotCount, 1);
});

test("public-catalog: giờ của bác sĩ đã tạm ngừng nhận lịch không được tính vào số giờ trống của khoa", async () => {
  await prisma.doctorTimeSlot.create({
    data: { doctorId: fixture.doctorTwo.id, date: fixture.slotOne.date, startTime: "11:00", endTime: "11:30" },
  });
  await prisma.doctorProfile.update({ where: { id: fixture.doctorTwo.id }, data: { isAvailable: false } });
  const item = await catalogItem();
  assert.equal(item.doctorCount, 1);
  assert.equal(item.availableSlotCount, 2);
});
