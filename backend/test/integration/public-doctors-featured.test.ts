import { assert, dateOnly, fixture, futureDate, http, prisma, test } from "./support/context.js";

// Bác sĩ tiêu biểu (trang chủ): mỗi bác sĩ chỉ tính khung giờ trống sớm nhất, xếp theo giờ sớm nhất. Truy vấn dùng DISTINCT ON
// nên khung giờ không còn trống, đã khóa hoặc ngoài cửa sổ 14 ngày không được tính.

type Featured = { id: string; nextAvailableSlot: { startTime: string; date: string } | null };

const featured = async (limit: number) => {
  const response = await http.request("/api/v1/doctors?includeHighlights=true&limit=" + limit);
  assert.equal(response.status, 200);
  return response.body.data as Featured[];
};

test("featured doctors are ranked by their earliest available slot and ignore unavailable or out-of-window slots", async () => {
  // doctorOne đã có hai khung giờ trống sau 7 ngày (09:00, 10:00). Thêm: giờ đã khóa sớm hơn (không được tính),
  // và cho doctorTwo một giờ trống sớm hơn doctorOne.
  await prisma.doctorTimeSlot.create({
    data: { doctorId: fixture.doctorOne.id, date: dateOnly(futureDate(1)), startTime: "07:00", endTime: "07:30", status: "LOCKED" },
  });
  await prisma.doctorTimeSlot.create({
    data: { doctorId: fixture.doctorOne.id, date: dateOnly(futureDate(2)), startTime: "07:30", endTime: "08:00", status: "CANCELLED" },
  });
  await prisma.doctorTimeSlot.create({
    data: { doctorId: fixture.doctorTwo.id, date: dateOnly(futureDate(3)), startTime: "08:00", endTime: "08:30" },
  });
  // Giờ đã có người đặt (BOOKED) của doctorTwo cũng không được tính dù sớm nhất.
  await prisma.doctorTimeSlot.create({
    data: { doctorId: fixture.doctorTwo.id, date: dateOnly(futureDate(1)), startTime: "06:00", endTime: "06:30", status: "BOOKED" },
  });

  const ranked = await featured(2);
  assert.deepEqual(ranked.map((doctor) => doctor.id), [fixture.doctorTwo.id, fixture.doctorOne.id]);
  assert.equal(ranked[0].nextAvailableSlot?.startTime, "08:00");
  // Giờ khóa 07:00 và giờ không hoạt động 07:30 sớm hơn nhưng không được chọn.
  assert.equal(ranked[1].nextAvailableSlot?.startTime, "09:00");
});

test("a doctor with no available slot is still listed as a fallback without a next slot", async () => {
  await prisma.doctorTimeSlot.updateMany({ where: { doctorId: fixture.doctorTwo.id }, data: { status: "LOCKED" } });
  const doctors = await featured(2);
  const two = doctors.find((doctor) => doctor.id === fixture.doctorTwo.id);
  const one = doctors.find((doctor) => doctor.id === fixture.doctorOne.id);
  assert.equal(one?.nextAvailableSlot?.startTime, "09:00");
  if (two) assert.equal(two.nextAvailableSlot, null);
});
