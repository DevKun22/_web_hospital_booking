import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_patient_sections.dart';

void main() {
  testWidgets('reason chips fill the field and append without duplicating', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: BookingReasonChips(controller: controller)),
      ),
    );

    await tester.tap(find.text('Tái khám'));
    expect(controller.text, 'Tái khám');

    await tester.tap(find.text('Khám tổng quát'));
    expect(controller.text, 'Tái khám, Khám tổng quát');

    await tester.tap(find.text('Tái khám'));
    expect(controller.text, 'Tái khám, Khám tổng quát');
  });
}
