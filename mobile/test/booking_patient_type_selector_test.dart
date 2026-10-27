import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_patient_type_selector.dart';

void main() {
  testWidgets('relative booking stays a safe placeholder', (tester) async {
    var changedToRelative = false;
    var noticeOpened = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BookingPatientTypeSelector(
            onChanged: (value) {
              changedToRelative = value == BookingPatientType.relative;
            },
            onUnavailableRelativeTap: () => noticeOpened = true,
          ),
        ),
      ),
    );

    expect(find.text('Đặt cho bản thân'), findsOneWidget);
    expect(find.text('Đặt cho người thân'), findsOneWidget);
    expect(find.text('Sắp có'), findsOneWidget);

    await tester.tap(find.byKey(const Key('booking-patient-type-relative')));
    await tester.pump();

    expect(noticeOpened, isTrue);
    expect(changedToRelative, isFalse);
  });
}
