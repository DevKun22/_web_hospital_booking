import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_detail_sections.dart';

Map<String, dynamic> _json({Map<String, dynamic>? facility}) => {
  'id': 'a1',
  'bookingCode': 'HB-1',
  'appointmentDate': '2026-11-25',
  'startTime': '09:00',
  'endTime': '09:30',
  'status': 'CONFIRMED',
  'patientName': 'Người khám',
  'finalAmount': 250000,
  'doctor': {
    'id': 'd1',
    'title': 'BS.CKII',
    'user': {'fullName': 'Đỗ Quang Huy'},
  },
  'department': {'id': 'k1', 'name': 'Da liễu'},
  'facility': ?facility,
};

Future<void> _pump(WidgetTester tester, PatientAppointment appointment) {
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: AppointmentInformationCard(appointment: appointment),
        ),
      ),
    ),
  );
}

void main() {
  test('đọc nơi khám từ phản hồi, thiếu thì để trống', () {
    final withFacility = PatientAppointment.fromJson(
      _json(facility: {'id': 'f1', 'name': 'Chi nhánh Một', 'address': 'Số 1'}),
    );
    expect(withFacility.facilityName, 'Chi nhánh Một');
    expect(withFacility.facilityAddress, 'Số 1');

    final without = PatientAppointment.fromJson(_json());
    expect(without.facilityName, isNull);
  });

  testWidgets('chi tiết lịch hẹn hiện nơi khám khi có', (tester) async {
    await _pump(
      tester,
      PatientAppointment.fromJson(
        _json(
          facility: {'id': 'f1', 'name': 'Chi nhánh Một', 'address': 'Số 1'},
        ),
      ),
    );
    expect(find.text('Nơi khám'), findsOneWidget);
    expect(find.text('Chi nhánh Một, Số 1'), findsOneWidget);
  });

  testWidgets('không hiện dòng nơi khám khi chưa có thông tin', (tester) async {
    await _pump(tester, PatientAppointment.fromJson(_json()));
    expect(find.text('Nơi khám'), findsNothing);
  });
}
