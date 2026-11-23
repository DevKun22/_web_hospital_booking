import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';
import 'package:hospital_booking_mobile/core/widgets/app_form.dart';
import 'package:hospital_booking_mobile/core/widgets/birth_date_picker.dart';

void main() {
  testWidgets('chọn ngày sinh theo thập niên, năm, tháng, ngày', (
    tester,
  ) async {
    DateTime? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () async => result = await showBirthDatePicker(context),
            child: const Text('mở'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('mở'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('birth-decade-1990')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('birth-year-1993')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('birth-month-9')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('birth-day-9')));
    await tester.pumpAndSettle();

    expect(result, DateTime(1993, 9, 9));
  });

  testWidgets('không cho chọn ngày hôm nay hoặc tương lai', (tester) async {
    final today = vietnamToday();
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => showBirthDatePicker(
              context,
              initial: DateTime(today.year, today.month, 1),
            ),
            child: const Text('mở'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('mở'));
    await tester.pumpAndSettle();

    // Ngày hôm nay và các ngày sau trong tháng hiện tại không có nút chọn.
    expect(find.byKey(ValueKey('birth-day-${today.day}')), findsNothing);
    if (today.day > 1) {
      expect(find.byKey(const ValueKey('birth-day-1')), findsOneWidget);
    }
    // Năm sau năm nay không xuất hiện.
    expect(find.byKey(ValueKey('birth-year-${today.year + 1}')), findsNothing);
  });

  testWidgets(
    'chọn giới tính: chạm đổi giá trị, chạm lại mục đang chọn thì bỏ chọn',
    (tester) async {
      String? selected;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) => AppSegmentedChoice<String>(
                label: 'Giới tính',
                items: const ['MALE', 'FEMALE', 'OTHER'],
                selected: selected,
                labelOf: (value) => switch (value) {
                  'MALE' => 'Nam',
                  'FEMALE' => 'Nữ',
                  _ => 'Khác',
                },
                onChanged: (value) => setState(() => selected = value),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Nữ'));
      await tester.pump();
      expect(selected, 'FEMALE');
      await tester.tap(find.text('Nam'));
      await tester.pump();
      expect(selected, 'MALE');
      await tester.tap(find.text('Nam'));
      await tester.pump();
      expect(selected, isNull);
    },
  );

  testWidgets('bộ đếm ký tự chỉ hiện khi sắp chạm giới hạn', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TextField(
            controller: controller,
            maxLength: 20,
            buildCounter: nearLimitCounter,
          ),
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), 'abc');
    await tester.pump();
    expect(find.text('3/20'), findsNothing);

    await tester.enterText(find.byType(TextField), 'abcdefghijklmnopqr');
    await tester.pump();
    expect(find.text('18/20'), findsOneWidget);
  });
}
