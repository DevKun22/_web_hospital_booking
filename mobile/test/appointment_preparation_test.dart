import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_preparation_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/data/appointment_preparation_store.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/appointment_preparation.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_preparation_card.dart';

const _appointment = PatientAppointment(
  id: 'appointment-1',
  bookingCode: 'HB-1001',
  appointmentDate: '2030-01-02',
  startTime: '09:00',
  endTime: '09:30',
  status: PatientAppointmentStatus.confirmed,
  doctorName: 'BS. Nguyễn Văn An',
  departmentName: 'Tim mạch',
  finalAmount: 250000,
);

void main() {
  test(
    'adds the health-insurance item only when the appointment uses BHYT',
    () {
      final withoutBhyt = buildAppointmentPreparationItems(hasBhyt: false);
      final withBhyt = buildAppointmentPreparationItems(hasBhyt: true);

      expect(withoutBhyt, hasLength(4));
      expect(
        withoutBhyt,
        isNot(contains(AppointmentPreparationItem.healthInsurance)),
      );
      expect(withBhyt, hasLength(5));
      expect(withBhyt, contains(AppointmentPreparationItem.healthInsurance));
    },
  );

  test('keeps completed items isolated by patient and appointment', () async {
    final store = MemoryAppointmentPreparationStore();
    await store.write('patient-1:appointment-1', {'identity_document'});

    expect(await store.read('patient-1:appointment-1'), {'identity_document'});
    expect(await store.read('patient-2:appointment-1'), isEmpty);
    expect(await store.read('patient-1:appointment-2'), isEmpty);
  });

  testWidgets('persists checklist progress for the same account and booking', (
    tester,
  ) async {
    final store = MemoryAppointmentPreparationStore();

    Future<void> pumpCard() => tester.pumpWidget(
      ProviderScope(
        overrides: [
          appointmentPreparationStoreProvider.overrideWithValue(store),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: AppointmentPreparationCard(
                userId: 'patient-1',
                appointment: _appointment,
              ),
            ),
          ),
        ),
      ),
    );

    await pumpCard();
    await tester.pumpAndSettle();
    expect(find.text('0/4'), findsOneWidget);

    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();
    expect(find.text('1/4'), findsOneWidget);

    await pumpCard();
    await tester.pumpAndSettle();
    expect(find.text('1/4'), findsOneWidget);
  });
}
