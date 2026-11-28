import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/slot_availability.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_calendar_dialog.dart';

void main() {
  test('mức còn trống theo số khung giờ', () {
    expect(SlotAvailability.of(0), SlotAvailability.none);
    expect(SlotAvailability.of(-1), SlotAvailability.none);
    expect(SlotAvailability.of(1), SlotAvailability.low);
    expect(SlotAvailability.of(lowSlotThreshold), SlotAvailability.low);
    expect(SlotAvailability.of(lowSlotThreshold + 1), SlotAvailability.plenty);
    expect(SlotAvailability.none.isBookable, isFalse);
    expect(SlotAvailability.low.isBookable, isTrue);
  });

  testWidgets('lịch tô số vàng khi sắp hết và xanh lá khi còn nhiều', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final today = vietnamToday();
    final first = DateTime(today.year, today.month, today.day);
    final lowDay = first.add(const Duration(days: 1));
    final plentyDay = first.add(const Duration(days: 2));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          doctorAvailableDatesProvider('d1').overrideWith(
            (ref) async => {
              formatApiDate(lowDay): 2,
              formatApiDate(plentyDay): 9,
            },
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(body: BookingCalendarDialog(doctorId: 'd1')),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Gần cuối tháng, ngày kế tiếp nằm ở tháng sau (lịch mở ở tháng hiện tại): sang tháng sau trước khi đọc màu.
    Future<Color> colorOf(DateTime day, int count) async {
      final cell = find.byKey(ValueKey('booking-date-${formatApiDate(day)}'));
      if (cell.evaluate().isEmpty) {
        await tester.tap(find.byTooltip('Tháng sau'));
        await tester.pumpAndSettle();
      }
      final text = find.descendant(of: cell, matching: find.text('$count'));
      return tester.widget<Text>(text.last).style!.color!;
    }

    final colors = AppColors.light;
    expect(await colorOf(lowDay, 2), colors.warning);
    expect(await colorOf(plentyDay, 9), colors.success);
    expect(find.textContaining('sắp hết'), findsWidgets);
  });
}
