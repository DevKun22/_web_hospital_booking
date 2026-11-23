import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_calendar_dialog.dart';

void main() {
  for (final scale in const [1.0, 2.0]) {
    testWidgets('lịch hiện số khung giờ còn trống cạnh ngày, cỡ chữ $scale', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final today = vietnamToday();
      final day = DateTime(today.year, today.month, today.day);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            doctorAvailableDatesProvider(
              'd1',
            ).overrideWith((ref) async => {formatApiDate(day): 7}),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            builder: (context, home) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: home!,
            ),
            home: const Scaffold(body: BookingCalendarDialog(doctorId: 'd1')),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('7'), findsWidgets);
      expect(find.textContaining('số khung giờ còn trống'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
