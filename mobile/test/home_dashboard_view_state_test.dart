import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/home/application/home_dashboard_view_state.dart';

PatientAppointment _appointment({
  required String id,
  required String date,
  required PatientAppointmentStatus status,
}) => PatientAppointment(
  id: id,
  bookingCode: 'HB-$id',
  appointmentDate: date,
  startTime: '09:00',
  endTime: '09:30',
  status: status,
  doctorName: 'BS. Nguyễn An',
  departmentName: 'Tim mạch',
  finalAmount: 250000,
);

void main() {
  test('dashboard selects the nearest actionable appointment', () {
    final result = HomeDashboardViewState.fromSources(
      auth: const AuthState(
        status: AuthStatus.authenticated,
        user: PatientUser(
          id: 'patient-1',
          fullName: 'Nguyễn Văn An',
          isPhoneVerified: true,
        ),
      ),
      appointments: [
        _appointment(
          id: 'otp',
          date: '2030-01-01',
          status: PatientAppointmentStatus.pendingOtp,
        ),
        _appointment(
          id: 'later',
          date: '2030-01-03',
          status: PatientAppointmentStatus.confirmed,
        ),
        _appointment(
          id: 'nearest',
          date: '2030-01-02',
          status: PatientAppointmentStatus.pendingConfirm,
        ),
        _appointment(
          id: 'history',
          date: '2029-01-01',
          status: PatientAppointmentStatus.completed,
        ),
      ],
      unreadNotificationCount: 4,
      now: DateTime(2030, 1, 1),
    );

    expect(result.nextAppointment?.id, 'nearest');
    expect(result.unreadNotificationCount, 4);
  });

  test('guest dashboard never exposes protected patient data', () {
    final result = HomeDashboardViewState.fromSources(
      auth: const AuthState.unauthenticated(),
      appointments: [
        _appointment(
          id: 'private',
          date: '2030-01-02',
          status: PatientAppointmentStatus.confirmed,
        ),
      ],
      unreadNotificationCount: 8,
      now: DateTime(2030, 1, 1),
    );

    expect(result.nextAppointment, isNull);
    expect(result.user, isNull);
    expect(result.unreadNotificationCount, 0);
  });
}
