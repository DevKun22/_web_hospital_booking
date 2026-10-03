import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_start_screen.dart';

String _tomorrowInVietnam() {
  final now = DateTime.now().toUtc().add(const Duration(hours: 7));
  final date = DateTime(
    now.year,
    now.month,
    now.day,
  ).add(const Duration(days: 1));
  return '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}

class _LoadedBookingFlowController extends BookingFlowController {
  @override
  BookingFlowState build() {
    final date = _tomorrowInVietnam();
    return BookingFlowState(
      departments: const [
        BookingDepartment(id: 'department-1', name: 'Tim mạch'),
      ],
      doctors: const [
        BookingDoctor(
          id: 'doctor-1',
          fullName: 'Nguyễn Văn An',
          departmentId: 'department-1',
          departmentName: 'Tim mạch',
          consultationFee: 250000,
          title: 'BS. CKI',
          experience: 12,
        ),
      ],
      slots: [
        BookingSlot(
          id: 'slot-1',
          date: date,
          startTime: '09:00',
          endTime: '09:30',
        ),
      ],
      selection: BookingSelection(
        departmentId: 'department-1',
        doctorId: 'doctor-1',
        date: date,
        slotId: 'slot-1',
      ),
    );
  }
}

void main() {
  testWidgets('renders a complete server-backed booking selection', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          bookingFlowControllerProvider.overrideWith(
            _LoadedBookingFlowController.new,
          ),
        ],
        child: const MaterialApp(home: BookingStartScreen()),
      ),
    );

    expect(find.text('Chọn chuyên khoa'), findsOneWidget);
    expect(find.text('Chọn bác sĩ'), findsOneWidget);
    expect(find.text('Chọn ngày khám'), findsOneWidget);
    expect(find.text('Chọn khung giờ'), findsOneWidget);
    expect(find.text('BS. CKI Nguyễn Văn An'), findsWidgets);
    expect(find.text('09:00 – 09:30'), findsWidgets);
    expect(find.text('ĐÃ CHỌN ĐỦ THÔNG TIN'), findsOneWidget);
  });
}
