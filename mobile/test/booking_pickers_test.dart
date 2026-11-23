import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_calendar_dialog.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_doctor_picker.dart';

CatalogDoctor _doctor(String id, String name, String departmentId) =>
    CatalogDoctor(
      id: id,
      fullName: name,
      departmentId: departmentId,
      departmentName: departmentId == 'd1' ? 'Da liễu' : 'Tim mạch',
      consultationFee: 250000,
    );

void main() {
  testWidgets('bảng chọn bác sĩ tìm không dấu và lọc theo chuyên khoa', (
    tester,
  ) async {
    String? picked;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => showBookingDoctorPicker(
              context,
              doctors: [
                _doctor('a', 'Đỗ Quang Huy', 'd1'),
                _doctor('b', 'Lê Thu An', 'd2'),
              ],
              departments: const [
                CatalogDepartment(id: 'd1', name: 'Da liễu'),
                CatalogDepartment(id: 'd2', name: 'Tim mạch'),
              ],
              onSelected: (id) => picked = id,
            ),
            child: const Text('mở'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('mở'));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('booking-doctor-a')), findsOneWidget);
    expect(find.byKey(const ValueKey('booking-doctor-b')), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('booking-picker-search')),
      'do quang',
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('booking-doctor-a')), findsOneWidget);
    expect(find.byKey(const ValueKey('booking-doctor-b')), findsNothing);

    await tester.tap(find.byKey(const ValueKey('booking-doctor-a')));
    await tester.pumpAndSettle();
    expect(picked, 'a');
  });

  testWidgets('vuốt ngang danh sách bác sĩ sang chip chuyên khoa kế tiếp', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => showBookingDoctorPicker(
              context,
              doctors: [
                _doctor('a', 'Đỗ Quang Huy', 'd1'),
                _doctor('b', 'Lê Thu An', 'd2'),
              ],
              departments: const [
                CatalogDepartment(id: 'd1', name: 'Da liễu'),
                CatalogDepartment(id: 'd2', name: 'Tim mạch'),
              ],
              onSelected: (_) {},
            ),
            child: const Text('mở'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('mở'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('booking-doctor-b')), findsOneWidget);

    await tester.fling(
      find.byKey(const ValueKey('booking-doctor-a')),
      const Offset(-400, 0),
      1500,
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('booking-doctor-a')), findsOneWidget);
    expect(find.byKey(const ValueKey('booking-doctor-b')), findsNothing);

    await tester.fling(
      find.byKey(const ValueKey('booking-doctor-a')),
      const Offset(400, 0),
      1500,
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('booking-doctor-b')), findsOneWidget);
  });

  testWidgets('lịch tháng chỉ cho chọn ngày còn giờ trống', (tester) async {
    final today = vietnamToday();
    final from = DateTime(today.year, today.month, today.day);
    final open = formatApiDate(from.add(const Duration(days: 1)));
    final closed = formatApiDate(from.add(const Duration(days: 2)));
    String? result;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          doctorAvailableDatesProvider(
            'a',
          ).overrideWith((ref) async => {open: 3}),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (context) => TextButton(
              onPressed: () async =>
                  result = await showBookingCalendar(context, doctorId: 'a'),
              child: const Text('mở'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('mở'));
    await tester.pumpAndSettle();

    final closedFinder = find.byKey(ValueKey('booking-date-$closed'));
    if (closedFinder.evaluate().isNotEmpty) {
      await tester.tap(closedFinder, warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(result, isNull);
    }
    final openFinder = find.byKey(ValueKey('booking-date-$open'));
    if (openFinder.evaluate().isEmpty) {
      await tester.tap(find.byTooltip('Tháng sau'));
      await tester.pumpAndSettle();
    }
    await tester.tap(find.byKey(ValueKey('booking-date-$open')));
    await tester.pumpAndSettle();
    expect(result, open);
  });
}
