import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_device_actions.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

void main() {
  const actions = AppointmentDeviceActions();
  final appointment = PatientAppointment(
    id: 'appointment with spaces',
    bookingCode: 'HB 1001/2026',
    appointmentDate: '2030-04-05',
    startTime: '09:15:00',
    endTime: '09:45:00',
    status: PatientAppointmentStatus.confirmed,
    patientName: 'Nguyễn Văn An',
    doctorName: 'BS. Trần Minh',
    departmentName: 'Tim mạch',
    finalAmount: 250000,
  );

  test('builds deterministic local calendar timestamps', () {
    expect(appointment.scheduledStart, DateTime(2030, 4, 5, 9, 15));
    expect(appointment.scheduledEnd, DateTime(2030, 4, 5, 9, 45));
  });

  test('QR payload contains only opaque appointment identity and booking code', () {
    final payload = actions.qrPayload(appointment);
    expect(payload, contains('/appointments/appointment%20with%20spaces'));
    expect(payload, contains('code=HB+1001%2F2026'));
    expect(payload, isNot(contains(appointment.patientName)));
    expect(payload, isNot(contains(appointment.doctorName)));
  });
}
