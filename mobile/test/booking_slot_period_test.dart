import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_slot_picker.dart';

void main() {
  test('slots are grouped into morning, afternoon and evening', () {
    expect(slotPeriodOf('08:00'), SlotPeriod.morning);
    expect(slotPeriodOf('11:30'), SlotPeriod.morning);
    expect(slotPeriodOf('12:00'), SlotPeriod.afternoon);
    expect(slotPeriodOf('17:30'), SlotPeriod.afternoon);
    expect(slotPeriodOf('18:00'), SlotPeriod.evening);
    expect(slotPeriodOf('không hợp lệ'), SlotPeriod.morning);
  });
}
