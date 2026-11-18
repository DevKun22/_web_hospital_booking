import { assert, fixture, prisma, test } from "./support/context.js";
import SlotPlannerService from "../../src/services/slotPlanner.service.js";
import DoctorScheduleService from "../../src/services/doctorSchedule.service.js";

// Sinh khung giờ định kỳ chỉ ghi khung giờ MỚI: lượt chạy lặp lại khi chưa có gì thay đổi không được gọi createMany.
test("regenerating an unchanged window issues no insert at all", async () => {
  await prisma.doctorTimeSlot.deleteMany({ where: { doctorId: fixture.doctorOne.id } });
  await prisma.doctorSchedule.deleteMany({ where: { doctorId: fixture.doctorOne.id } });
  for (let day = 0; day < 7; day += 1) {
    await DoctorScheduleService.create({
      doctorId: fixture.doctorOne.id,
      dayOfWeek: day,
      startTime: "08:00",
      endTime: "09:00",
      slotDuration: 30,
    });
  }
  const before = await prisma.doctorTimeSlot.count({ where: { doctorId: fixture.doctorOne.id } });
  assert.ok(before > 0);

  const original = prisma.doctorTimeSlot.createMany.bind(prisma.doctorTimeSlot);
  let createManyCalls = 0;
  (prisma.doctorTimeSlot as unknown as { createMany: typeof original }).createMany = ((args: Parameters<typeof original>[0]) => {
    createManyCalls += 1;
    return original(args);
  }) as typeof original;
  try {
    const again = await SlotPlannerService.refreshDoctor(fixture.doctorOne.id);
    assert.equal(again.generatedCount, 0);
    assert.equal(createManyCalls, 0);
  } finally {
    (prisma.doctorTimeSlot as unknown as { createMany: typeof original }).createMany = original;
  }
  assert.equal(await prisma.doctorTimeSlot.count({ where: { doctorId: fixture.doctorOne.id } }), before);
});
