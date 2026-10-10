import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/appointments_screen.dart';

PatientAppointment _appointment({
  required String id,
  required PatientAppointmentStatus status,
}) => PatientAppointment(
  id: id,
  bookingCode: 'HB-$id',
  appointmentDate: '2030-01-02',
  startTime: '09:00:00',
  endTime: '09:30:00',
  status: status,
  doctorName: 'BS. CKI Trần Minh',
  departmentName: 'Tim mạch',
  finalAmount: 250000,
);

class _LoadedAppointmentsController extends AppointmentsController {
  @override
  AppointmentsState build() => AppointmentsState(
    items: [
      _appointment(id: 'UPCOMING', status: PatientAppointmentStatus.confirmed),
      _appointment(
        id: 'HISTORY',
        status: PatientAppointmentStatus.cancelledByPatient,
      ),
    ],
    total: 2,
  );
}

void main() {
  testWidgets('shows upcoming appointments and can switch to history', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(900, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final router = GoRouter(
      initialLocation: '/appointments',
      routes: [
        GoRoute(
          path: '/appointments',
          builder: (_, _) => const AppointmentsScreen(),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) => Scaffold(
                body: Text('Chi tiết ${state.pathParameters['id']}'),
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/booking',
          builder: (_, _) => const Scaffold(body: Text('Đặt lịch')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appointmentsControllerProvider.overrideWith(
            _LoadedAppointmentsController.new,
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đã xác nhận'), findsOneWidget);
    expect(find.text('HB-UPCOMING'), findsOneWidget);
    expect(find.text('02/01/2030 · 09:00 – 09:30'), findsOneWidget);
    expect(find.text('Bạn đã hủy'), findsNothing);

    await tester.tap(find.text('Đã qua'));
    await tester.pumpAndSettle();

    expect(find.text('Bạn đã hủy'), findsOneWidget);
    expect(find.text('HB-HISTORY'), findsOneWidget);
    expect(find.text('Đã xác nhận'), findsNothing);
  });
}
