import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_start_screen.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

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

class _PackageBookingFlowController extends BookingFlowController {
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
        ),
      ],
      packages: const [
        MedicalPackage(
          id: 'package-1',
          name: 'Gói tim mạch',
          slug: 'goi-tim-mach',
          departmentId: 'department-1',
          departmentName: 'Tim mạch',
          basePrice: 800000,
          serviceFee: 50000,
          includedItemsTotal: 800000,
          finalPrice: 850000,
          isPopular: true,
          isBhytSupport: true,
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
        serviceMode: BookingServiceMode.package,
        packageId: 'package-1',
        departmentId: 'department-1',
        doctorId: 'doctor-1',
        date: date,
        slotId: 'slot-1',
      ),
    );
  }
}

class _RecordingBookingFlowController extends BookingFlowController {
  final appliedDepartments = <String?>[];

  @override
  BookingFlowState build() => const BookingFlowState(
    departments: [
      BookingDepartment(id: 'department-1', name: 'Tim mạch'),
      BookingDepartment(id: 'department-2', name: 'Khoa nhi'),
    ],
  );

  @override
  Future<void> applyPreset({
    String? packageId,
    String? departmentId,
    String? doctorId,
    String? date,
    String? timeSlotId,
  }) async {
    appliedDepartments.add(departmentId);
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

    final dateSemantics = tester.getSemantics(
      find.byKey(ValueKey('booking-date-${_tomorrowInVietnam()}')),
    );
    final slotSemantics = tester.getSemantics(
      find.byKey(const ValueKey('booking-slot-slot-1')),
    );
    expect(
      dateSemantics.getSemanticsData().flagsCollection.isSelected,
      Tristate.isTrue,
    );
    expect(
      slotSemantics.getSemanticsData().flagsCollection.isSelected,
      Tristate.isTrue,
    );
  });

  testWidgets('renders package mode with locked department and package price', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 3200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          bookingFlowControllerProvider.overrideWith(
            _PackageBookingFlowController.new,
          ),
        ],
        child: const MaterialApp(home: BookingStartScreen()),
      ),
    );

    expect(find.text('Theo gói khám'), findsOneWidget);
    expect(find.text('Gói tim mạch'), findsWidgets);
    expect(find.text('Giá gói: 850.000 đ'), findsOneWidget);
    expect(find.text('Đổi gói'), findsOneWidget);
    expect(find.byIcon(Icons.lock_outline_rounded), findsOneWidget);
    expect(find.text('ĐÃ CHỌN ĐỦ THÔNG TIN'), findsOneWidget);
  });

  testWidgets('reapplies route preset when booking query changes', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        bookingFlowControllerProvider.overrideWith(
          _RecordingBookingFlowController.new,
        ),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: BookingStartScreen(
            key: ValueKey('booking'),
            departmentId: 'department-1',
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: BookingStartScreen(
            key: ValueKey('booking'),
            departmentId: 'department-2',
          ),
        ),
      ),
    );
    await tester.pump();

    final controller =
        container.read(bookingFlowControllerProvider.notifier)
            as _RecordingBookingFlowController;
    expect(controller.appliedDepartments, ['department-1', 'department-2']);
  });
}
