import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_journey_indicator.dart';

void main() {
  testWidgets('booking journey exposes the current step to accessibility', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: BookingJourneyIndicator(currentStep: 1)),
      ),
    );

    expect(find.text('Chọn lịch'), findsOneWidget);
    expect(find.text('Thông tin'), findsOneWidget);
    expect(find.text('Xác thực'), findsOneWidget);
    expect(
      find.bySemanticsLabel(RegExp('Bước 2 trên 3: Thông tin')),
      findsOneWidget,
    );
    semantics.dispose();
  });
}
