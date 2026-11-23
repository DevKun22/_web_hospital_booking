import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_appointment_action_card.dart';

PatientAppointment _appointment(PatientAppointmentStatus status, String date) =>
    PatientAppointment(
      id: 'a1',
      bookingCode: 'BK20261121344797',
      appointmentDate: date,
      startTime: '08:30',
      endTime: '09:00',
      status: status,
      doctorName: 'PGS.TS.BSCKII Nguyễn Minh Hoàng Phúc Thịnh',
      departmentName: 'Khoa cơ xương khớp và phục hồi chức năng',
      finalAmount: 350000,
    );

String _isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

void main() {
  final today = _isoDate(DateTime.now());
  final later = _isoDate(DateTime.now().add(const Duration(days: 5)));
  final cases = <String, PatientAppointment>{
    'chờ xác nhận': _appointment(
      PatientAppointmentStatus.pendingConfirm,
      later,
    ),
    'sắp tới': _appointment(PatientAppointmentStatus.confirmed, later),
    'hôm nay': _appointment(PatientAppointmentStatus.confirmed, today),
    'đã check-in': _appointment(PatientAppointmentStatus.checkedIn, today),
    'đang khám': _appointment(PatientAppointmentStatus.inProgress, today),
  };

  for (final scale in const [1.0, 1.3, 1.6, 2.0]) {
    for (final entry in cases.entries) {
      testWidgets('thẻ nhắc lịch ${entry.key} không vỡ ở cỡ chữ $scale', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(360, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            builder: (context, home) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: home!,
            ),
            home: Scaffold(
              body: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: HomeAppointmentActionCard(
                  appointment: entry.value,
                  onOpen: () {},
                  onShowQr: () {},
                ),
              ),
            ),
          ),
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
      });
    }
  }

  testWidgets('lịch hôm nay ghi giờ khám ngay ở tiêu đề', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: HomeAppointmentActionCard(
            appointment: cases['hôm nay']!,
            onOpen: () {},
            onShowQr: () {},
          ),
        ),
      ),
    );
    expect(find.text('Khám hôm nay lúc 08:30'), findsOneWidget);
    expect(find.text('Sẵn sàng đi khám'), findsOneWidget);
  });
}
