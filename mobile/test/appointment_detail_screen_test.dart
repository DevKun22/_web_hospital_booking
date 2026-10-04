import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/data/appointments_repository.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/appointment_detail_screen.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';

const _patient = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  isPhoneVerified: true,
);

const _appointment = PatientAppointment(
  id: 'appointment-1',
  bookingCode: 'HB-1001',
  appointmentDate: '2030-01-02',
  startTime: '09:00',
  endTime: '09:30',
  status: PatientAppointmentStatus.confirmed,
  doctorName: 'BS. CKI Trần Minh',
  departmentName: 'Tim mạch',
  reason: 'Khám định kỳ',
  estimatedPrice: 250000,
  finalAmount: 250000,
);

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _patient);
}

class _DetailRepository extends AppointmentsRepository {
  _DetailRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  @override
  Future<AppointmentPage> list({int page = 1, int limit = 20}) async =>
      const AppointmentPage(
        items: [_appointment],
        page: 1,
        total: 1,
        hasNextPage: false,
      );

  @override
  Future<PatientAppointment> getById(String id) async => _appointment;
}

void main() {
  testWidgets(
    'closing cancellation sheet keeps its controller alive through animation',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_AuthenticatedController.new),
            appointmentsRepositoryProvider.overrideWithValue(
              _DetailRepository(),
            ),
          ],
          child: const MaterialApp(
            home: AppointmentDetailScreen(appointmentId: 'appointment-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.text('Yêu cầu hủy lịch'),
        350,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Yêu cầu hủy lịch'));
      await tester.pumpAndSettle();
      expect(find.text('Xác nhận hủy lịch'), findsOneWidget);

      await tester.tap(find.text('Giữ lịch'));
      await tester.pumpAndSettle();

      expect(find.text('Xác nhận hủy lịch'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
