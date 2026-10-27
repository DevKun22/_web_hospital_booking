import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_qr_ticket.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_appointment_action_card.dart';

const _appointment = PatientAppointment(
  id: 'appointment-1',
  bookingCode: 'HB-1001',
  appointmentDate: '2030-01-02',
  startTime: '09:00',
  endTime: '09:30',
  status: PatientAppointmentStatus.confirmed,
  doctorName: 'BS. CKI Nguyễn Văn An',
  departmentName: 'Tim mạch',
  finalAmount: 250000,
);

void main() {
  testWidgets('home appointment actions remain usable at larger text scale', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
          child: Scaffold(
            body: SizedBox(
              width: 360,
              child: HomeAppointmentActionCard(
                appointment: _appointment,
                onOpen: () {},
                onShowQr: () {},
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('home-appointment-qr')), findsOneWidget);
    expect(find.byKey(const Key('home-appointment-prepare')), findsOneWidget);
    expect(
      tester.getSize(find.byKey(const Key('home-appointment-qr'))).height,
      greaterThanOrEqualTo(48),
    );
  });

  testWidgets('shared QR ticket carries a useful accessibility label', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(
          body: AppointmentQrTicketDialog(
            appointment: _appointment,
            payload: 'hospitalbooking://app/appointments/appointment-1',
          ),
        ),
      ),
    );

    expect(find.bySemanticsLabel('QR mã lịch HB-1001'), findsOneWidget);
    expect(find.text('Không chia sẻ công khai ảnh QR.'), findsNothing);
    expect(find.textContaining('Không chia sẻ công khai'), findsOneWidget);
  });

  testWidgets('checked-in appointment prioritizes progress over QR', (
    tester,
  ) async {
    const checkedIn = PatientAppointment(
      id: 'appointment-2',
      bookingCode: 'HB-1002',
      appointmentDate: '2030-01-02',
      startTime: '09:00',
      endTime: '09:30',
      status: PatientAppointmentStatus.checkedIn,
      doctorName: 'BS. CKI Nguyễn Văn An',
      departmentName: 'Tim mạch',
      finalAmount: 250000,
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: HomeAppointmentActionCard(
            appointment: checkedIn,
            onOpen: () {},
            onShowQr: () {},
          ),
        ),
      ),
    );

    expect(find.text('Bạn đã check-in'), findsOneWidget);
    expect(find.byKey(const Key('home-appointment-follow')), findsOneWidget);
    expect(find.text('Theo dõi tiến trình'), findsOneWidget);
    expect(find.byKey(const Key('home-appointment-qr')), findsNothing);
  });
}
